define(["moment", "app/config", "core/utils", "jquery"], function(moment, config, utils) {
    var database = {};

    function isInternetExplorer() {
        return false || !!document.documentMode;
    }

    var DATABASE_VERSION = isInternetExplorer() ? 2 : 1;
    
    database.db = null;
    
    var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

    var openRequest;

    if (isInternetExplorer()) {
		if (!openRequest) {
			openRequest = indexedDB.open("history.db", 1);
		}
		openRequest = indexedDB.open("history.db", DATABASE_VERSION);
    } else {
        openRequest = indexedDB.open("history.db", DATABASE_VERSION);
    }

    openRequest.onupgradeneeded = function(event) { 
        var db = event.target.result;
        
		var urlObjectStore = db.createObjectStore("urls", { 
			keyPath: "id", 
			autoIncrement:true 
		});  
	
		urlObjectStore.createIndex("id", "id", { 
			unique: true 
		});

		urlObjectStore.createIndex("lastVisitTime", "lastVisitTime", { 
			unique: false 
		});

		urlObjectStore.createIndex("title", "title", { 
			unique: false 
		});

		urlObjectStore.createIndex("typedCount", "typedCount", { 
			unique: false 
		});

		urlObjectStore.createIndex("visitCount", "visitCount", { 
			unique: false 
		});
		

		var visitObjectStore = db.createObjectStore("visits", { 
			keyPath: "visitId", 
			autoIncrement:true 
		});  

		visitObjectStore.createIndex("visitId", "visitId", { 
			unique: true 
		});

		visitObjectStore.createIndex("id", "id", { 
			unique: false 
		});

		visitObjectStore.createIndex("title", "title", { 
			unique: false 
		});

		visitObjectStore.createIndex("url", "url", { 
			unique: false 
		});

		visitObjectStore.createIndex("referringVisitId", "referringVisitId", { 
			unique: false 
		});

		visitObjectStore.createIndex("transition", "transition", { 
			unique: false 
		});

		visitObjectStore.createIndex("visitTime", "visitTime", { 
			unique: false 
		});

		visitObjectStore.createIndex("protocol", "protocol", { 
			unique: false 
		});

		visitObjectStore.createIndex("domain", "domain", { 
			unique: false 
		});

		visitObjectStore.createIndex("searchTerms", "searchTerms", { 
			unique: false 
		});

		visitObjectStore.createIndex("transmitted", "transmitted", { 
			unique: false 
		});

		visitObjectStore.createIndex("visitOrigin", "visitOrigin", { // The 'visitOrigin' is only available on Safari. For other browsers, this is ignored.
			unique: false 
		});


		var categoryObjectStore = db.createObjectStore("categories", { 
			autoIncrement:true 
		});  

		categoryObjectStore.createIndex("search", "search", { 
			unique: false 
		});

		categoryObjectStore.createIndex("category", "category", { 
			unique: false 
		});

		categoryObjectStore.createIndex("value", "value", { 
			unique: false 
		});


		var eventObjectStore = db.createObjectStore("events", { 
			keyPath: "id", 
			autoIncrement:true 
		});  
	
		eventObjectStore.createIndex("id", "id", { 
			unique: true 
		});

		eventObjectStore.createIndex("event", "event", { 
			unique: false 
		});

		eventObjectStore.createIndex("details", "details", { 
			unique: false 
		});

		eventObjectStore.createIndex("date", "date", { 
			unique: false 
		});

		eventObjectStore.createIndex("transmitted", "transmitted", { 
			unique: false 
		});
    }

    if (isInternetExplorer()) {
        openRequest.onerror = function (e) {
            indexedDB.deleteDatabase("history.db");
        };
    }
    
    openRequest.onsuccess = function(e) {
        database.db = e.target.result;
        
        database.db.onerror = function(event) {
            alert("Database error: " + event.target.errorCode);
            console.dir(event.target);
        };
        
        if ((isInternetExplorer() && database.Start != undefined) ||
            (!isInternetExplorer() && database.onSyncStart != undefined)) {
            database.onSyncStart();
        }
        
        var trans = database.db.transaction(['urls'], "readonly");
        var urls = trans.objectStore('urls');
        var index = urls.index('lastVisitTime');

        var cursorRequest = index.openCursor(null, "prev");

        cursorRequest.onsuccess = function(e) {
            var cursor = e.target.result;
            var startTime = 0;
        
            if (cursor) {
                startTime = cursor.value.lastVisitTime;
            }

            chrome.history.search({
                'text': '',
                'maxResults': (typeof browser == "undefined" ? 0 : Number.MAX_SAFE_INTEGER),
                'startTime': startTime
            }, function(historyItems) {
                var trans = database.db.transaction(['urls'], "readwrite");
                var urls = trans.objectStore('urls');

                for (var i = 0; i < historyItems.length; i++) {
                    var historyItem = historyItems[i];
                    
					if (historyItem['url'].indexOf("data") != 0) {
						urls.put(historyItem);

						database.toPopulate.push({
							'url': historyItem['url'], 
							'title': historyItem['title'],
							'startTime': startTime
						});
					} else {
						console.log('Omitting ' + historyItem);
					}
                }

                database.totalPendingItems = database.toPopulate.length;
                
                database.populatePendingUrls();
            });
        };

        var categories = database.db.transaction(['categories'], "readonly").objectStore('categories');

        var countRequest = categories.count();
        
        countRequest.onsuccess = function() {
            if (countRequest.result == 0) {
                $.get('core/js/app/categories.json', function(data) {
						var children = data["children"];
					    
						var categories = database.db.transaction(['categories'], "readwrite").objectStore('categories');
			
						for (var i = 0; i < children.length; i++) {
							categories.put(children[i]);
						}
					}, 'json');
				}
            }
        }
    

    database.waitForDatabase = function(callback) {
        if (database.db == null) {
            window.setTimeout(function() {
                database.waitForDatabase(callback);
            }, 10);
        } else {
            callback();
        }
    };
    
    database.filter = function(tableName, indexName, valueQuery, direction, filterCallback, failCallback) {
        database.waitForDatabase(function() {
            console.log('FILTER ' + tableName + ' -- ' + indexName);
            
            var transaction = database.db.transaction([ tableName ], "readwrite");

            var store = transaction.objectStore(tableName);
            var index = store.index(indexName);

            var request = null;
        
            if (valueQuery != null) {
                if (direction != null) {
                    request = index.openCursor(valueQuery, direction);
                } else {
                    request = index.openCursor(valueQuery);
                }
            } else {
                request = index.openCursor();
            }       
                
            request.onsuccess = function(event) {
                var cursor = event.target.result;

                filterCallback(cursor);
            };

            request.onerror = function(event) {
                console.log('DATABASE: Error on FILTER from \'' + tableName + '.' + indexName + '\', DIRECTION = \'' + direction + '\'. Event:');
                console.log(event);
            
                failCallback();
            };
        });
    };
    
    var URI = function (url) {
          if (!url) url = "";
          // Based on the regex in RFC2396 Appendix B.
          var parser = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;
          var result = url.match(parser);
          this.scheme = result[1] || null;
          this.authority = result[2] || null;
          this.path = result[3] || null;
          this.query = result[4] || null;
          this.fragment = result[5] || null;
    };
    
    var fetchDomain = function(url, title) {
        if (url.match(/\.google\.[a-z\.]*\/maps/)) { // Google Maps
            return 'google.com/maps';
        }

        var parser = new URI(url);
        
        if (parser.scheme == 'chrome-extension') { // Chrome extension
            if (title != '') {
                return title + " Extension"
            }
            
            return "Chrome Extension";
        }

        if (parser.scheme == 'moz-extension') { // Firefox extension
            if (title != '') {
                return title + " Extension"
            }
            
            return "Firefox Extension";
        }

        if (parser.scheme == 'file') { // Local file
            return "Local File";
        }
	    
	if (parser.authority == null) {
	    console.log('NULL authority: ' + url);
            return "Unknown Authority";
	}
        
        if (parser.authority.match(/www\.google\.[a-z\.]*$/) || parser.authority.match(/^google\.[a-z\.]*$/)) {
            return "google.com";
        }

        if (parser.authority.match(/\.google\.[a-z\.]*$/) || parser.authority.match(/\.blogspot\.[a-z\.]*$/)) { // Misc. Google sites
            return parser.authority;
        }

        if (parser.authority.match(/^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/)) { // xxx.yy.zzz
            return parser.authority.replace(/^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/, "$1");
        }

        if (parser.authority.match(/^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/)) { // xx.yy.zzz
            return parser.authority.replace(/^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z]\.[a-zA-Z][a-zA-Z])$/, "$1");
        }

        return parser.authority.replace(/^.*\.([\w\d_-]*\.[a-zA-Z][a-zA-Z][a-zA-Z]?[a-zA-Z]?)$/, "$1");
    };

    database.toPopulate = [];
        
    database.populatePendingUrls = function() {
        if (database.toPopulate.length == 0) {
            if (database.onSyncEnd != undefined) {
                database.onSyncEnd();
            }

            return;
        }
        
        if (database.onSyncProgress != undefined) {
            database.onSyncProgress(database.totalPendingItems, database.totalPendingItems - database.toPopulate.length);
        }
        
        var historyItem = database.toPopulate.pop();
        
        chrome.history.getVisits({
            url: historyItem['url']
        }, function(visitItems) {
            var trans = database.db.transaction(['visits'], "readwrite");
            var visits = trans.objectStore('visits');

            var parser = new URI(historyItem['url']);
            var domain = fetchDomain(historyItem['url'], historyItem['title']);

            var reGoogle = /\.google\.[a-z\.]*$/;
            var reBing = /\.bing\.com/;
            var reAsk = /\.ask\.[a-z\.]*$/;
            var reSearch = /q=([^&]+)/;

            var reYahooSearchDomain = /search\.yahoo\.[a-z\.]*$/;
            var reYahooSearch = /p=([^&]+)/;

            for (var j = 0; j < visitItems.length; j++) {
                var visitItem = visitItems[j];
                
                visitItem['url'] = historyItem['url'];
                visitItem['title'] = historyItem['title'];
                visitItem['protocol'] = parser.scheme;
                visitItem['domain'] = domain;

                var host = parser.authority;

                if (host == null) {
                    host = "local_file";
                }

                visitItem['searchTerms'] = '';

                if (reGoogle.test(host) || host === "duckduckgo.com" || reBing.test(host) || host === "search.aol.com" || host === reAsk.test(host)) {
                    if (reSearch.test(historyItem['url'])) {
                        search = historyItem['url'].match(reSearch, "$1");
                        if (search[1] != "") {
                            var searchTerms1 = search[1];

                            var dcSearchTerms = decodeURIComponent(searchTerms1);
                            visitItem['searchTerms'] = dcSearchTerms.replace(/\+/g, " ");
                        }
                    }
                }

                if (reYahooSearchDomain.test(host)) {
                    if (reYahooSearch.test(parser.href)) {
                        var yahooSearch = historyItem['url'].match(reYahooSearch, "$1");
                        
                        if (yahooSearch[1] != "") {
                            var searchTerms1 = yahooSearch[1];

                            var dcSearchTerms = decodeURIComponent(searchTerms1);
                            visitItem['searchTerms'] = dcSearchTerms.replace(/\+/g, " ");
                        }
                    }
                }
                
                if (visitItem['visitTime'] > historyItem['startTime']) {
                    visitItem['transmitted'] = 0;

                    visits.put(visitItem);
                }
            }
            
            window.setTimeout(database.populatePendingUrls, 0);
        });
    };
    
    database.fetchCategories = function(callback) {
        var categories = [];
        
        database.filter('categories', 'search', null, null, function(cursor) {
            if (cursor) {
                categories.push({
                    'search': cursor.value.search,
                    'value': cursor.value.value,
                    'category': cursor.value.category
                });
                
                cursor.continue();
            } else {
                callback(categories);
            }
        }, function() {
            console.log('Failed to retrieve categories.');
        });
    };

    database.fetchRecords = function(start, end, callback) {
        var records = [];
        
        if (start == null) {
            start = new Date(0);
        }
        
        if (end == null) {
            end = new Date();
        }

        database.filter('visits', 'visitTime', IDBKeyRange.bound(start.getTime(), end.getTime()), null, function(cursor) {
            if (cursor) {
                records.push(cursor.value);
                
                cursor.continue();
            } else {
                callback(records);
            }
        }, function() {
            console.log('Failed to retrieve visits.');
        });
    };

    database.clearDomains = function(domains, callback) {
        if (domains.length == 0) {
            callback();
        } else {
            var trans = database.db.transaction(['visits'], "readwrite");
            var visits = trans.objectStore('visits');
        
            var domain = visits.index("domain");
        
            var domainName = domains.pop();
            
            var openRequest = domain.openCursor(IDBKeyRange.only(domainName));
            
            openRequest.onsuccess = function(event) {
                var cursor = event.target.result;
                
                if (cursor) {
                    var deleteRequest = cursor.delete();

                    deleteRequest.onsuccess = function() {
                        cursor.continue();  
                    };                  
                } else {
                    database.clearDomains(domains, callback);
                }
            };
        }
    };

    database.clearUrls = function(urlList, callback) {
        if (urlList.length == 0) {
            callback();
        } else {
            var trans = database.db.transaction(['visits'], "readwrite");
            var visits = trans.objectStore('visits');
        
            var url = visits.index("url");
        
            var singleUrl = urlList.pop();
    
            var openRequest = url.openCursor(IDBKeyRange.only(singleUrl));
            
            openRequest.onsuccess = function(event) {
                var cursor = event.target.result;
                
                if (cursor) {
                    var deleteRequest = cursor.delete();

                    deleteRequest.onsuccess = function() {
                        cursor.continue();  
                    };                  
                } else {
                    database.clearUrls(urlList, callback);
                }
            };
        }
    };

    database.clearSearches = function(searchTerm, callback) {
        if (searchTerm.length == 0) {
            callback();
        } else {
            var trans = database.db.transaction(['visits'], "readwrite");
            var visits = trans.objectStore('visits');
            
            var urlList = []
        
            var openRequest = visits.openCursor();
            
            openRequest.onsuccess = function(event) {
                var cursor = event.target.result;
                
                if (cursor) {
                	if (cursor.value.searchTerms.indexOf(searchTerm) != -1) {
                	    if (urlList.indexOf(cursor.value.url) == -1) {
	                		urlList.push(cursor.value.url);
	                	}
                	}

                    cursor.continue();  
                } else {
                    database.clearUrls(urlList, callback);
                }
            };
        }
    };
    
    database.logEvent = function(event, details) {
        var trans = database.db.transaction(['events'], "readwrite");
        var events = trans.objectStore('events');
        
        var eventItem = {
            "event": event,
            "date": Date.now(),
            "transmitted": 0
        };
        
        if (details != null) {
            eventItem['details'] = details
        }
        
        events.put(eventItem);
    };
    
    database.uploadPending = function(onProgress, onComplete, onFailure) {
        if (onProgress == null || onProgress == undefined) {
            onProgress = function(index, length) {
                console.log('PDK Upload Progress: ' + index + ' / ' + length);
            };
        }
        
        if (onComplete == null || onComplete == undefined) {
            onComplete = function() {
                console.log('PDK Upload Completed');
            };
        }

        if (onFailure == null || onFailure == undefined) {
            onFailure = function(reason) {
                console.log('PDK Upload Failure: ' + reason);
            };
        }

        chrome.storage.local.get({
            'upload_identifier': 'unknown-user'
        }, function(result) {
            requirejs(["passive-data-kit"], function(pdk) {
                var bundles = [];
                var bundle = [];

                var trans = database.db.transaction(['visits'], "readwrite");
                var visits = trans.objectStore('visits');
                
                var index = visits.index("transmitted");

                var countRequest = index.count(IDBKeyRange.only(0));
                
                countRequest.onsuccess = function() {
                    database.filter('visits', 'transmitted', IDBKeyRange.only(0), null, function(cursor) {
                        if (cursor && bundles.length < 50) {
                            var visit = {
                                "domain": cursor.value['domain'],
                                "title": cursor.value['title'],
                                "url": cursor.value['url'],
                                "refVisitId": cursor.value['referringVisitId'],
                                "searchTerms": cursor.value['searchTerms'],
                                "transType": cursor.value['transition'],
                                "date": cursor.value['visitTime'],
                                "id": cursor.value['id'],
                                "visitId": cursor.value['visitId']
                            };
                            if ("visitOrigin" in cursor.value) { // The 'visitOrigin' is only available on Safari. For other browsers, this will not be appended.
                                visit["visitOrigin"] = cursor.value['visitOrigin'];
                            };
                            
                            bundle.push(visit);

                            var updateItem = cursor.value;
                        
                            updateItem['transmitted'] = Date.now();
                        
                            var request = cursor.update(updateItem);

                            request.onerror = function(e){
                                console.log('Error adding: ' + e);
                            };

                            request.onsuccess = function() {
//                                console.log('UPDATED');
                                cursor.continue();
                            };

                            if (bundle.length >= 250) {
                                bundles.push(bundle);
                                bundle  = []
                            }
                        } else {
                            if (bundle.length > 0) {
                                bundles.push(bundle);
                            };
                        
                            if (bundles.length > 0) {
                                pdk.upload(config.uploadUrl, result.upload_identifier, 'web-historian', bundles, 0, onProgress, function() {
                                    database.uploadPending(onProgress, onComplete, onFailure);
                                }, onFailure);
                            } else {
                                onComplete();
                            }
                        }
                    }, function() {
                        console.log('Failed to retrieve visits.');
                    });
                }
                
                database.uploadEvents(null, null, null);
            });
        });
    };

    database.uploadEvents = function(onProgress, onComplete, onFailure) {
        if (onProgress == null || onProgress == undefined) {
            onProgress = function(index, length) {
                console.log('PDK Upload Events Progress: ' + index + ' / ' + length);
            };
        }
        
        if (onComplete == null || onComplete == undefined) {
            onComplete = function() {
                console.log('PDK Upload Events Completed');
            };
        }

        if (onFailure == null || onFailure == undefined) {
            onFailure = function(reason) {
                console.log('PDK Upload Events Failure: ' + reason);
            };
        }

        chrome.storage.local.get({
            'upload_identifier': 'unknown-user'
        }, function(result) {
            requirejs(["passive-data-kit"], function(pdk) {
                var events = [];
                
                database.filter('events', 'transmitted', IDBKeyRange.only(0), null, function(cursor) {
                    if (cursor) {
                        var event = {
                            "event_name": cursor.value['event'],
                            "date": cursor.value['date']
                        };
                        
                        if (cursor.value['details'] != undefined && cursor.value['details'] != null) {
                            event['event_details'] = cursor.value['details'];
                        }

                        var updateItem = cursor.value;
                        
                        updateItem['transmitted'] = Date.now();
                        
                        var request = cursor.update(updateItem);

                        request.onsuccess = function(e){

                        };
                        
                        request.onerror = function(e){
                            console.log('Error adding: ' + e);
                        };

                        events.push(event);
                                                
                        cursor.continue();
                    } else {
                        if (events.length > 0) {
                            pdk.upload(config.uploadUrl, result.upload_identifier, 'pdk-app-event', [events], 0, onProgress, onComplete);
                        }
                    }
                }, function() {
                    onFailure('Failed to retrieve events.');
                });
            });
        });
    };
    
    database.earliestDate = function(callback) {
        database.filter('visits', 'visitTime', null, "prev", function(cursor) {
            if (cursor) {
                callback(cursor.value);
            } else {
                callback(null);
            }
        }, function() {
            console.log('Failed to retrieve earliest visit.');
        });
    
    };
    
    database.clearData = function(callback) {
        var transaction = database.db.transaction([ "urls" ], "readwrite");
        var urlStore = transaction.objectStore("urls");
        
        var clearUrlsRequest = urlStore.clear();
        
        clearUrlsRequest.onsuccess = function(event) {
            var transaction = database.db.transaction([ "visits" ], "readwrite");
            var visitStore = transaction.objectStore("visits");
        
            var clearVisitsRequest = visitStore.clear();
        
            clearVisitsRequest.onsuccess = function(event) {
                callback();
            };
        };
    };
    
    database.replaceWithSampleData = function(sampleDataUrl, callback) {
        database.clearData(function() {
            $.get(sampleDataUrl, function(data) {
                var visits = [];
                var urls = [];
                var urlMap = {};
                
                for (var i = 0; i < data.length; i++) {
                    var datum = data[i];
                    
                    var visit = {}
                    
                    visit['id'] = datum["id"];
                    visit['visitId'] = datum["id"];
                    visit['title'] = datum["title"];
                    visit['url'] = datum["url"];
                    visit['referringVisitId'] = datum["refVisitId"];
                    visit['transition'] = datum["transType"];
                    visit['visitTime'] = Date.now() - (1000 * 60 * 60 * (Math.random() * 24));
                    visit['protocol'] = datum["protocol"];
                    visit['domain'] = datum["domain"];
                    visit['searchTerms'] = datum["searchTerms"];
                    visit['transmitted'] = Date.now();
                    
                    visits.push(visit);

                    var urlItem = urlMap[datum["url"]];
                    
                    if (urlItem == undefined) {
                        var url = {};
                        
                        url["id"] = datum["urlId"];
                        url["lastVisitTime"] = 0;
                        url["title"] = datum["title"];
                        url["typedCount"] = 0;
                        url["visitCount"] = 1;
                        
                        urls.push(url);
                        
                        urlMap[datum["url"]] = url;
                    } else {
                        urlItem["visitCount"] += 1;

                        if (urlItem["lastVisitTime"] < visit['visitTime']) {
                            urlItem["lastVisitTime"] = visit['visitTime'];
                        }
                    }
                }
                
                var insertVisits = function() {
                    if (visits.length == 0) {
                    	callback();
                    } else {
						var trans = database.db.transaction(['visits'], "readwrite");
						var visitStore = trans.objectStore('visits');

						var visitItem = visits.pop();
					
						var insertRequest = visitStore.put(visitItem);
					
						insertRequest.onsuccess = function() {
							insertVisits();
						};
					}
                };
                
                var insertUrls = function() {
                    if (urls.length == 0) {
                    	insertVisits();
                    } else {
						var trans = database.db.transaction(['urls'], "readwrite");
						var urlStore = trans.objectStore('urls');

						var urlItem = urls.pop();
					
						var insertRequest = urlStore.put(urlItem);
					
						insertRequest.onsuccess = function() {
							insertUrls();
						};
					}
                };
                
                insertUrls();
            });
        });
    };

    return database;
});
