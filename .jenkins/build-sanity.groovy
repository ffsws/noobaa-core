def cico_retries = 16
def cico_retry_interval = 60
def ci_git_repo = 'https://github.com/noobaa/noobaa-core'
def ci_git_ref = 'master' // default, will be overwritten for PRs

def HASH = '0123abcd' // default, will be overwritten
def NO_CACHE = 'NO_CACHE=true'
// building with Docker fails in the CI due to network restrictions
def CONTAINER_ENGINE = 'CONTAINER_ENGINE=podman'

node('cico-workspace') {
	if (params.ghprbPullId != null) {
		ci_git_ref = "pull/${ghprbPullId}/head"
	}

	stage('checkout ci repository') {
		// TODO: only need to fetch the .jenkins directory, no tags, ..
		checkout([$class: 'GitSCM', branches: [[name: 'FETCH_HEAD']],
			userRemoteConfigs: [[url: "${ci_git_repo}", refspec: "${ci_git_ref}"]]])
		// fetch the first 7 characters of the current commit hash
		HASH = sh(
			script: 'git log -1 --format=format:%H | cut -c-7',
			returnStdout: true
		).trim()
		env.IMAGE_TAG = "noobaa-${HASH}"
		env.TESTER_TAG = "noobaa-tester-${HASH}"
	}

	stage('reserve bare-metal machine') {
		def firstAttempt = true
		retry(30) {
			if (!firstAttempt) {
				sleep(time: 5, unit: "MINUTES")
			}
			firstAttempt = false
			cico = sh(
				script: "cico node get -f value -c hostname -c comment --release=8 --retry-count=${cico_retries} --retry-interval=${cico_retry_interval}",
				returnStdout: true
			).trim().tokenize(' ')
			env.CICO_NODE = "${cico[0]}.ci.centos.org"
			env.CICO_SSID = "${cico[1]}"
		}
	}

	try {
		stage('prepare bare-metal machine') {
			sh 'scp -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ./.jenkins/prepare.sh root@${CICO_NODE}:'
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} ./prepare.sh --workdir=/opt/build/noobaa-core --gitrepo=${ci_git_repo} --ref=${ci_git_ref}"
		}

		// real test start here
		stage('Build & Sanity Integration Tests') {
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} 'cd /opt/build/noobaa-core && ./.travis/deploy_minikube.sh'"
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} 'cd /opt/build/noobaa-core && make tester NOOBAA_TAG=${IMAGE_TAG} TESTER_TAG=${TESTER_TAG} ${NO_CACHE} ${CONTAINER_ENGINE}'"
			// images were built with podman, import them in Docker for use with minikube
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} 'podman image save ${IMAGE_TAG} | docker image load'"
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} 'podman image save ${TESTER_TAG} | docker image load'"
			sh "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@${CICO_NODE} 'cd /opt/build/noobaa-core && cd ./src/test/framework/ && ./run_test_job.sh --name ${HASH} --image localhost/${IMAGE_TAG} --tester_image localhost/${TESTER_TAG} --job_yaml ../../../.travis/travis_test_job.yaml --wait'"
		}
	}

	finally {
		stage('return bare-metal machine') {
			sh 'cico node done ${CICO_SSID}'
		}
	}
}
