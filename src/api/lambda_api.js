/* Copyright (C) 2016 NooBaa */
'use strict';

/**
 *
 * LAMBDA API
 *
 */
module.exports = {

    id: 'lambda_api',

    methods: {

        create_func: {
            method: 'POST',
            params: {
                type: 'object',
                required: ['config', 'code'],
                properties: {
                    config: {
                        $ref: '#/definitions/func_config'
                    },
                    code: {
                        $ref: '#/definitions/func_code'
                    },
                    publish: {
                        type: 'boolean'
                    },
                }
            },
            auth: {
                system: 'admin'
            }
        },

        update_func: {
            method: 'PUT',
            params: {
                type: 'object',
                properties: {
                    config: {
                        $ref: '#/definitions/func_config'
                    },
                    code: {
                        $ref: '#/definitions/func_code'
                    },
                }
            },
            auth: {
                system: 'admin'
            }
        },

        delete_func: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    version: {
                        type: 'string'
                    },
                },
            },
            auth: {
                system: 'admin'
            }
        },

        read_func: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    version: {
                        type: 'string'
                    },
                },
            },
            reply: {
                $ref: '#/definitions/func_info'
            },
            auth: {
                system: 'admin'
            }
        },

        list_funcs: {
            method: 'GET',
            reply: {
                type: 'object',
                properties: {
                    functions: {
                        type: 'array',
                        items: {
                            $ref: '#/definitions/func_info'
                        }
                    },
                },
            },
            auth: {
                system: 'admin'
            }
        },

        list_func_versions: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    }
                },
            },
            reply: {
                type: 'object',
                properties: {
                    versions: {
                        type: 'array',
                        items: {
                            $ref: '#/definitions/func_info'
                        }
                    },
                },
            },
            auth: {
                system: 'admin'
            }
        },

        invoke_func: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string'
                    },
                    version: {
                        type: 'string'
                    },
                    event: {
                        $ref: '#/definitions/event_type'
                    }
                },
            },
            reply: {
                type: 'object',
                properties: {
                    result: {
                        $ref: '#/definitions/event_type'
                    },
                    error: {
                        $ref: '#/definitions/error_type'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        /*
        allocate_func_maps: {
            method: 'PUT',
            params: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string'
                    }
                },
            },
            reply: {
                $ref: '#/definitions/lambda_func_info'
            },
            auth: {
                system: 'admin'
            }
        },
        */

    },

    definitions: {

        func_config: {
            type: 'object',
            required: ['name'],
            properties: {
                name: {
                    type: 'string'
                },
                version: {
                    type: 'string'
                },
                description: {
                    type: 'string'
                },
                role: {
                    type: 'string'
                },
                handler: {
                    type: 'string'
                },
                runtime: {
                    type: 'string',
                    enum: [
                        'nodejs6',
                        // 'nodejs',
                        // 'nodejs4.3',
                        // 'java8',
                        // 'python2.7',
                    ]
                },
                memory_size: {
                    type: 'integer'
                },
                timeout: {
                    type: 'integer'
                },
                // the following fields are not configurable,
                // and will be returned as info
                code_size: {
                    type: 'integer'
                },
                code_sha256: {
                    type: 'string'
                },
                last_modified: {
                    format: 'date'
                },
            }
        },

        func_code: {
            type: 'object',
            properties: {
                zipfile: {
                    buffer: true
                },
                s3_bucket: {
                    type: 'string'
                },
                s3_key: {
                    type: 'string'
                },
                s3_obj_version: {
                    type: 'string'
                },
                s3_endpoint: {
                    type: 'string'
                },
                url: {
                    type: 'string'
                },
            }
        },

        func_code_location: {
            type: 'object',
            required: ['url', 'repository'],
            properties: {
                url: {
                    type: 'string'
                },
                repository: {
                    type: 'string'
                },
            }
        },

        func_info: {
            type: 'object',
            required: ['config', 'code_location'],
            properties: {
                config: {
                    $ref: '#/definitions/func_config'
                },
                code_location: {
                    $ref: '#/definitions/func_code_location'
                },
            }
        },

        event_type: {
            oneOf: [{
                type: 'object',
                additionalProperties: true,
                properties: {},
            }, {
                type: 'string'
            }]
        },

        error_type: {
            type: 'object',
            required: ['message'],
            properties: {
                message: {
                    type: 'string'
                },
                stack: {
                    type: 'string'
                },
            },
        },

    }

};
