import * as model from 'model';
import page from 'page';
import api from 'services/api';
import config from 'config';
import { hostname as endpoint } from 'server-conf';
import { isDefined, isUndefined, encodeBase64, cmpStrings, cmpInts, cmpBools, 
	randomString, last, stringifyQueryString, clamp } from 'utils';

// TODO: resolve browserify issue with export of the aws-sdk module.
// The current workaround use the AWS that is set on the global window object.
import 'aws-sdk';
AWS = window.AWS;

// -----------------------------------------------------
// Utility function to log actions.
// -----------------------------------------------------
function logAction(action, payload) {
	if (typeof payload !== 'undefined') {
		console.info(`action dispatched: ${action} with`, payload);
	} else {
		console.info(`action dispatched: ${action}`);
	}
}

// -----------------------------------------------------
// Applicaiton start action
// -----------------------------------------------------
export function start() {
	logAction('start');
	
	api.options.auth_token = localStorage.getItem('sessionToken');
	return api.auth.read_auth()
		// Try to restore the last session
		.then(({account, system}) => {
			if (isDefined(account)) {
				model.sessionInfo({ 
					user: account.email, 
					system: system.name 
				});
			} 
		})
		// Start the router.
		.then(() => page.start())
		.done()
}

// -----------------------------------------------------
// Navigation actions
// -----------------------------------------------------
export function navigateTo(path = window.location.pathname, query = {}) {
	logAction('navigateTo', { path, query });

	page.show(`${path}?${stringifyQueryString(query)}`);
}

export function redirectTo(path = window.location.pathname, query = {}) {
	logAction('navigateTo', { path, query });

	page.redirect(`${path}?${stringifyQueryString(query)}`);
}

export function refresh() {
	logAction('refresh');

	let { pathname, search } = window.location;
	
	// Reload the current path
	page.redirect(pathname + search);
}

// -----------------------------------------------------
// High level UI update actions. 
// -----------------------------------------------------
export function showLogin() {
	logAction('showLogin');

	let session = model.sessionInfo();
	let ctx = model.routeContext();

	if (!!session) {
		redirectTo(`/fe/systems/${session.system}`);

	} else {
		model.uiState({ 
			layout: 'login-layout', 
			returnUrl: ctx.query.returnUrl,
		});

		loadServerInfo();
	}
}	

export function showOverview() {
	logAction('showOverview');

	model.uiState({
		layout: 'main-layout',
		title: 'OVERVIEW',
		breadcrumbs: [], 
		panel: 'overview'	
	});

	loadSystemOverview();
}

export function showBuckets() {
	logAction('showBuckets');	

	model.uiState({
		layout: 'main-layout',
		title: 'BUCKETS',
		breadcrumbs: [ { href: "fe/systems/:system" } ],
		panel: 'buckets',
	});

	let { sortBy, order } = model.routeContext().query;
	loadBucketList(sortBy, order);
}

export function showBucket() {
	logAction('showBucket');

	let ctx = model.routeContext();
	let { bucket, tab = 'objects' } = ctx.params;
	let { filter, sortBy = 'name', order = 1, page = 0 } = ctx.query;

	model.uiState({
		layout: 'main-layout',
		title: bucket,
		breadcrumbs: [
			{ href: "fe/systems/:system" },
			{ href: "buckets", label: "BUCKETS" },
		],
		panel: 'bucket',
		tab: tab
	});

	loadBucketInfo(bucket);
	loadBucketObjectList(bucket, filter, sortBy, parseInt(order), parseInt(page));		
}

export function showObject() {
	logAction('showObject');
	
	let ctx = model.routeContext();
	let { object, bucket, tab = 'parts' } = ctx.params;
	let { page = 0 } = ctx.query;

	model.uiState({
		layout: 'main-layout',
		title: object,
		breadcrumbs: [
			{ href: "fe/systems/:system" },
			{ href: "buckets", label: "BUCKETS" },
			{ href: ":bucket", label: bucket },
		],			
		panel: 'object',
		tab: tab
	});

	loadObjectMetadata(bucket, object)
	loadObjectPartList(bucket, object, parseInt(page));
}

export function showPools() {
	logAction('showPools');

	model.uiState({
		layout: 'main-layout',
		title: 'POOLS',
		breadcrumbs: [ { href: "fe/systems/:system" } ],
		panel: 'pools'
	});

	let { sortBy, order } = model.routeContext().query;
	loadPoolList(sortBy, order);
}

export function showPool() {
	logAction('showPool');

	let ctx = model.routeContext();
	let { pool, tab = 'nodes' } = ctx.params;
	let { filter, sortBy = 'name', order = 1, page = 0 } = ctx.query;

	
	model.uiState({
		layout: 'main-layout',
		title: pool,
		breadcrumbs: [ 
			{ href: "fe/systems/:system" },
			{ href: "pools", label: "POOLS"}
		],
		panel: 'pool',
		tab: tab
	});

	loadPoolInfo(pool);
	loadPoolNodeList(pool, filter, sortBy, parseInt(order), parseInt(page));
}

export function showNode() {
	logAction('showNode');

	let ctx = model.routeContext();
	let { pool, node, tab = 'parts' } = ctx.params;
	let { page = 0 } = ctx.query;

	model.uiState({
		layout: 'main-layout',
		title: node,
		breadcrumbs: [
			{ href: "fe/systems/:system" },
			{ href: "pools", label: "POOLS"},
			{ href: ":pool", label: pool}
		],
		panel: 'node',
		tab: tab
	});

	loadNodeInfo(node);
	loadNodeStoredPartsList(node, parseInt(page));		
}	

export function showManagement() {
	logAction('showManagement');

	let { tab = 'accounts' } = model.routeContext().params;

	model.uiState({
		layout: 'main-layout',
		title: 'SYSTEM MANAGEMENT',
		breadcrumbs: [ { href: "fe/systems/:system" } ],
		panel: 'management',
		tab: tab
	});
}

export function showCreateBucketWizard() {
	loadAction('showCreateBucketModal')
}

export function openAuditLog() {
	logAction('openAuditLog');

	model.uiState(
		Object.assign(model.uiState(), { 
			tray: { componentName: 'audit-pane' }
		})
	);
}

export function closeTray() {
	logAction('closeTray');

	model.uiState(
		Object.assign(model.uiState(), { tray: null })
	);
}

// -----------------------------------------------------
// Sign In/Out actions.
// -----------------------------------------------------
export function signIn(email, password, redirectUrl) {
	logAction('signIn', { email, password, redirectUrl });

	api.create_auth_token({ email, password })
		.then(() => api.system.list_systems())
		.then(
			({ systems }) => {
				let system = systems[0].name;

				return api.create_auth_token({ system, email, password })
					.then(({ token }) => {
						localStorage.setItem('sessionToken', token);
						
						model.sessionInfo({ user: email, system: system })
						model.loginInfo({ retryCount: 0 });

						if (isUndefined(redirectUrl)) {
							redirectUrl = `/fe/systems/${system}`;
						}

						redirectTo(decodeURIComponent(redirectUrl));
					})
			}
		)
		.catch(
			err => {
				if (err.rpc_code === 'UNAUTHORIZED') {
					model.loginInfo({
						retryCount: model.loginInfo().retryCount + 1
					});

				} else {
					throw err;
				}
			}
		)
		.done();
}

export function signOut() {
	session.kill();

	localStorage.removeItem('sessionToken');
	model.sessionInfo(null);
	refresh();
}

// -----------------------------------------------------
// Information retrieval actions.
// -----------------------------------------------------
export function loadServerInfo() {
	logAction('loadServerInfo');

	api.account.accounts_status()
		.then(
			reply => model.serverInfo({
				endpoint: endpoint || window.location.hostname,
				initialized: reply.has_accounts
			})
		)
		.done();
}

export function loadSystemOverview() {
	logAction('loadSystemOverview');

	let systemOverview = model.systemOverview;
	api.system.read_system()
		.then(
			reply => {
				let { access_key, secret_key } = reply.access_keys[0];

				systemOverview({
					endpoint: endpoint,
					accessKey: access_key,
					secretKey: secret_key, 
					capacity: reply.storage.total,
					bucketCount: reply.buckets.length,
					objectCount: reply.objects,
					poolCount: reply.pools.length,
					nodeCount: reply.nodes.count,
					onlineNodeCount: reply.nodes.online,
					offlineNodeCount: reply.nodes.count - reply.nodes.online
				})	
			}
		)	
		.done();
}

const bucketCmpFuncs = Object.freeze({
	state: (b1, b2) => cmpBools(b1.state, b2.state),
	name: (b1, b2) => cmpStrings(b1.name, b2.name),
	filecount: (b1, b2) => cmpInts(b1.num_objects, b2.num_objects),
	totalsize: (b1, b2) => cmpInts(b1.storage.total, b2.storage.total),
	freesize: (b1, b2) => cmpInts(b1.storage.free, b2.storage.free),
	cloudsync: (b1, b2) => cmpStrings(b1.cloud_sync_status, b2.cloud_sync_status)
});

export function loadBucketList(sortBy = 'name', order = 1) {
	logAction('loadBucketList', { sortBy, order });

	// Normalize the order.
	order = clamp(order, -1, 1);

	let bucketList = model.bucketList;
	api.system.read_system()
		.then(
			({ buckets }) => {
				bucketList(
					buckets.sort(
						(b1, b2) => order * bucketCmpFuncs[sortBy](b1, b2)
					)
				);
				bucketList.sortedBy(sortBy);
				bucketList.order(order);
			}
		)
		.done();
}

const poolCmpFuncs = Object.freeze({
	state: (p1, p2) => cmpBools(true, true),
	name: (p1, p2) => cmpStrings(p1.name, p2.name),
	nodecount: (p1, p2) => cmpInts(p1.nodes.count, p2.nodes.count),
	onlinecount: (p1, p2) => cmpInts(p1.nodes.online, p2.nodes.online),
	offlinecount: (p1, p2) => cmpInts(
		p1.nodes.count - p1.nodes.online, 
		p2.nodes.count - p2.nodes.online, 
	),
	usage: (p1, p2) => cmpInts(p1.storage.used, p2.storage.used),
	capacity: (p1, p2) => cmpInts(p1.storage.total, p2.storage.total),
});

export function loadPoolList(sortBy = 'name', order = 1) {
	logAction('loadPoolList', { sortBy, order });

	// Normalize the order.
	order = clamp(order, -1, 1);

	let poolList = model.poolList;
	api.system.read_system()
		.then(
			({ pools }) => {
				poolList(
					pools.sort(
						(b1, b2) => order * poolCmpFuncs[sortBy](b1, b2)
					)
				);
				poolList.sortedBy(sortBy);
				poolList.order(order);
			}
		)
		.done();
}

export function loadAgentInstallationInfo() {
	logAction('loadAgentInstallationInfo');

	let { agentInstallationInfo } = model;
	api.system.read_system()
		.then(
			reply => {
				let keys = reply.access_keys[0];

				agentInstallationInfo({
					agentConf: encodeBase64({
		                address: reply.base_address,
		                system: reply.name,
		                access_key: keys.access_key,
		                secret_key: keys.secret_key,
		                tier: 'nodes',
		                root_path: './agent_storage/'
		            }),
					downloadUris: {
						windows: reply.web_links.agent_installer,
						linux: reply.web_links.linux_agent_installer
					}
				});
			}
		)
		.done();
}

export function loadBucketInfo(name) {
	logAction('loadBucketInfo', { name });

	api.bucket.read_bucket({ name })
		.then(model.bucketInfo)
		.done();
}

export function loadBucketPolicy(name) {
	logAction('loadBucketPolicy', { name });

	model.bucketPolicy(null);
	api.tiering_policy.read_policy({ name })
		.then(model.bucketPolicy)
		.done();
}

export function loadBucketObjectList(bucketName, filter, sortBy, order, page) {
	logAction('loadBucketObjectList', { bucketName, filter, sortBy, order, page });

	let bucketObjectList = model.bucketObjectList;

	api.object.list_objects({ 
			bucket: bucketName,
			key_query: filter,
			sort: sortBy,
			order: order,
			skip: config.paginationPageSize * page,
			limit: config.paginationPageSize,
			pagination: true
		})
		.then(
			reply => {
				bucketObjectList(reply.objects);
				bucketObjectList.sortedBy(sortBy);
				bucketObjectList.filter(filter);
				bucketObjectList.order(order);
				bucketObjectList.page(page);
				bucketObjectList.count(reply.total_count);
			}
		) 
		.done();
}

export function loadObjectMetadata(bucketName, objectName) {
	logAction('loadObjectMetadata', { bucketName, objectName });

	// Drop previous data if of diffrent object.
	if (!!model.objectInfo() && model.objectInfo().name !== objectName) {
		model.objectInfo(null);
	}

	let objInfoPromise = api.object.read_object_md({
		 bucket: bucketName, 
		 key: objectName,
		 get_parts_count: true
	});

	let S3Promise = api.system.read_system()
		.then(
			reply => {
				let { access_key, secret_key } = reply.access_keys[0];

				return new AWS.S3({
				    endpoint: reply.ip_address,
				    credentials: {
				    	accessKeyId:  access_key,
				    	secretAccessKey:  secret_key
				    },
				    s3ForcePathStyle: true,
				    sslEnabled: false,
				})
			}
		);

	Promise.all([objInfoPromise, S3Promise])
		.then(
			([objInfo, s3]) => model.objectInfo({ 
				name: objectName, 
				bucket: bucketName,
				info: objInfo,				
				s3Url: s3.getSignedUrl(
					'getObject', 
					{ Bucket: bucketName, Key: objectName }
				)
			})
		);
}

export function loadObjectPartList(bucketName, objectName, page) {
	logAction('loadObjectPartList', { bucketName, objectName, page });

	api.object.read_object_mappings({ 
		bucket: bucketName, 
		key: objectName, 
		skip: config.paginationPageSize * page,
		limit: config.paginationPageSize,
		adminfo: true 
	})
		.then(
			({ parts }) => {
				model.objectPartList(parts);
				model.objectPartList.page(page);

				// TODO: change to real count when avaliable.
				model.objectPartList.count(1000);				
			}
		)
		.done();
}

export function loadPoolInfo(name) {
	logAction('loadPoolInfo', { name });

	if (model.poolInfo() && model.poolInfo().name !== name) {
		model.poolInfo(null);
	}

	api.pool.read_pool({ name })
		.then(model.poolInfo)
		.done();
}

export function loadPoolNodeList(poolName, filter, sortBy, order, page) {
	logAction('loadPoolNodeList', { poolName, filter, sortBy, order, page });
	
	api.node.list_nodes({  
		query: {
			pool: [ poolName ],
			name: filter
		},
		sort: sortBy,
		order: order,
		skip: config.paginationPageSize * page,
		limit: config.paginationPageSize,
		pagination: true
	})
		.then(
			reply => {
				model.poolNodeList(reply.nodes);
				model.poolNodeList.count(reply.total_count);				
				model.poolNodeList.filter(filter);
				model.poolNodeList.sortedBy(sortBy);
				model.poolNodeList.order(order);
				model.poolNodeList.page(page)
			}
		)
		.done();
}

export function loadFullNodeList() {
	logAction('loadFullNodeList');

	api.node.list_nodes({})
		.then(
			reply => model.fullNodeList(reply.nodes)
		)
		.done();
}

export function loadNodeInfo(nodeName) {
	logAction('loadNodeInfo', { nodeName });

	if (model.nodeInfo() && model.nodeInfo().name !== nodeName) {
		model.nodeInfo(null);
	}

	api.node.read_node({ name: nodeName })
		.then(model.nodeInfo)
		.done();
}

export function loadNodeStoredPartsList(nodeName, page) {
	logAction('loadNodeStoredPartsList', { nodeName, page });

	api.node.read_node_maps({ name: nodeName })
		.then(
			reply => {
				let parts = reply.objects
					.map(
						obj => obj.parts.map(
							part => {
								return {
									object: obj.key,
									bucket: obj.bucket,
									info: part
								}
							}
						)
					)
					.reduce(
						(list, objParts) => {
							list.push(...objParts);
							return list;
						},
						[]
					);

				// TODO: change to server side paganation when avaliable.
				let pageParts = parts.slice(
					config.paginationPageSize * page,
					config.paginationPageSize * (page + 1),
				);

				model.nodeStoredPartList(pageParts);
				model.nodeStoredPartList.page(page);
				model.nodeStoredPartList.count(parts.length);
			}
		)
		.done();
}

export function loadAuditEntries(categories, count) {
	logAction('loadAuditEntries', { categories, count });

	let auditLog = model.auditLog;
	let filter = categories
		.map(
			category => `(^${category}.)`
		)
		.join('|');

	if (filter !== '') {
		api.system.read_activity_log({
			event: filter || '^$',
			limit: count
		})
			.then(
				({ logs }) => {
					auditLog(logs.reverse());
					auditLog.loadedCategories(categories);
				}
			)
			.done();

	} else {
		auditLog([]);
		auditLog.loadedCategories([]);
	}
}

export function loadMoreAuditEntries(count) {
	logAction('loadMoreAuditEntries', { count });

	let auditLog = model.auditLog;
	let lastEntryTime = last(auditLog()).time;
	let filter = model.auditLog.loadedCategories()
		.map(
			category => `(^${category}.)` 
		)
		.join('|');

	if (filter !== '') {
		api.system.read_activity_log({
			event: filter,
			till: lastEntryTime,
			limit: count 
		})
			.then(
				({ logs }) => auditLog.push(...logs.reverse())
			)
			.done()
	}
}

export function loadAccountList() {
	logAction('loadAccountList');

	api.account.list_system_accounts()
		.then(
			({ accounts }) => model.accountList(accounts)
		)
		.done()
}

export function loadTier(name) {
	logAction('loadTier', { name });

	api.tier.read_tier({ name })
		.then(model.tierInfo)
		.done();
}

// -----------------------------------------------------
// Managment actions.
// -----------------------------------------------------
export function createSystemAccount(systemName, email, password, dnsName) {
	logAction('createSystemAccount', { systemName, email, password, dnsName });

	api.account.create_account({ name: systemName, email: email, password: password })
		.then(
			({ token }) => {
				api.options.auth_token = token;
				localStorage.setItem('sessionToken', token);
				model.sessionInfo({ user: email, system: systemName});
			}
		)
		.then(
			() => {
				if (dnsName) {
					return api.system.update_base_address({
						base_address: dnsName
					});

				} else {
					return Promise.resolve(true);
				}
			}
		)
		.then(
			() => redirectTo(`/fe/systems/${systemName}`)
		)
		.done();
}

export function createAccount(name, email, password) {
	logAction('createAccount', { name, email, password });

	api.account.create_account({ name, email, password })
		.then(
			({ token }) => {
				api.options.auth_token = token;
				localStorage.setItem('sessionToken', token);
				model.sessionInfo({ user: email, system: system});
			}
		)
		.then(
			() => {
				if (dnsName) {
					return api.system.update_base_address({
						base_address: dnsName
					});

				} else {
					return Promise.when(true);
				}
			}
		)
		.done();	
}

export function createBucket(name, dataPlacement, pools) {
	logAction('createBucket', { name, dataPlacement, pools });

	let { bucketList } = model;

	api.tier.create_tier({ 
		name: randomString(8),
		data_placement: dataPlacement,
		pools: pools
	})
		.then(
			tier => {
				let policy = {
					// TODO: remove the random string after patching the server
					// with a delete bucket that deletes also the policy
					name: `${name}_tiering_${randomString(5)}`,
					tiers: [ { order: 0, tier: tier.name } ]
				};

				return api.tiering_policy.create_policy(policy)
					.then(() => policy)
			}
		)
		.then(
			policy => api.bucket.create_bucket({ 
				name: name, 
				tiering: policy.name  
			})
		)
		.then(
			() => loadBucketList(bucketList.sortedBy(), bucketList.order())
		)
		.done();
}

export function deleteBucket(name) {
	logAction('deleteBucket', { name });

	api.bucket.delete_bucket({ name })
		.then(refresh)
		.done();
}

export function updateTier(name, dataPlacement, pools) {
	logAction('updateTier', { name, dataPlacement, pools });

	api.tier.update_tier({ 
		name: name,
		data_placement: dataPlacement,
		pools: pools
	})
		.done();
}

export function createPool(name, nodes) {
	logAction('createPool', { name, nodes });

	let { poolList } = model;
	api.pool.create_pool({ name, nodes })
		.then(
			() => loadPoolList(poolList.sortedBy(), poolList.order())
		)
		.done();
}

export function deletePool(name) {
	logAction('deletePool', { name });

	api.pool.delete_pool({ name })
		.then(refresh)
		.done();
}

export function uploadFiles(bucketName, files) {
	logAction('uploadFiles', { bucketName, files });
	
	let recentUploads = model.recentUploads;
	api.system.read_system()
		.then(
			reply => {
				let { access_key, secret_key } = reply.access_keys[0];

				return new AWS.S3({
				    endpoint: reply.ip_address,
				    credentials: {
				    	accessKeyId:  access_key,
				    	secretAccessKey:  secret_key
				    },
				    s3ForcePathStyle: true,
				    sslEnabled: false,
				})
			}
		)
		.then(
			s3 => {
				let uploadRequests = Array.from(files).map(
					file => new Promise(
						(resolve, reject) => {
							// Create an entry in the recent uploaded list.
							let entry = {
								name: file.name,
								state: 'UPLOADING',
								progress: 0,
								error: null
							};
							recentUploads.unshift(entry);

							// Start the upload.
							s3.upload(
								{
									Key: file.name,
									Bucket: bucketName,
									Body: file,
									ContentType: file.type
								}, 
								error => {
									if (!error) {
										entry.state = 'COMPLETED';
										entry.progress = 1;
										resolve(1);

									} else {
										entry.state = 'FAILED';
										entry.error = error;
										
										// This is not a bug we want to resolve failed uploads
										// in order to finalize the entire upload process.
										resolve(0);
									}

									// Use replace to trigger change event.
									recentUploads.replace(entry, entry);
								}
							)
							//	Report on progress.
							.on('httpUploadProgress', 
								({ loaded, total }) => {
									entry.progress = loaded / total;

									// Use replace to trigger change event.
									recentUploads.replace(entry, entry);
								}
							);
						}
					)
				);

				return Promise.all(uploadRequests);
			}
		)
		.then(
			results => results.reduce(
				(sum, result) => sum += result
			)
		)
		.then(
			completedCount => {
				console.log('herer', completedCount);
				completedCount > 0 && refresh()
			}
		);
}