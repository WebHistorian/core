define(["core/utils", "app/config", "core/database", "moment", "d3-context-menu", "ion.rangeSlider"], function(utils, config, database, moment, context, rangeSlide) {
    var visualization = {};
    
    visualization.end = new Date();
    visualization.start = new Date(visualization.end.getTime() - (7 * 24 * 60 * 60 * 1000));

	function URI(str) {
		if (!str) str = "";
		// Based on the regex in RFC2396 Appendix B.
		var parser = /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;
		var result = str.match(parser);
		this.scheme = result[1] || null;
		this.authority = result[2] || null;
		this.path = result[3] || null;
		this.query = result[4] || null;
		this.fragment = result[5] || null;
	}

    function searchWebsites(query) {
        var theNodes = d3.selectAll(".node").filter(function(d) {
            var re = new RegExp(query, "gi");
            return d.className.match(re);
        });
//        console.log("matches: " + theNodes[0].length);
        d3.selectAll(".node").style("opacity", ".4");
        var nodeArr = theNodes[0];
        for (var i in nodeArr) {
            var aNode = nodeArr[i];
            d3.select(aNode).style("opacity", "1");
        }
        if (nodeArr.length === 0) {
            d3.selectAll(".node").style("opacity", "1");
        }
    }

    visualization.display = function(selector, pagesSelector, domainsSelector, toolbarSelector, canDelete, domName) {
        var change = 0;
        
        var dataSet = [];
        var domainCounts = {};
        var domainList = [];
        
		$("#loading_modal").modal("show");

		database.fetchRecords(null, null, function(records) {
			var recordsRev = utils.sortByPropRev(records, 'visitTime');
			if (domName==null) {
				recordsFilter = recordsRev;
				$("#panel_title").html("Web Historian: Explore Your Data");
			} else {
				recordsFilter = utils.onlyIf(recordsRev,'domain',domName,false);
				$("#panel_title").html("Web Historian: Exploring data from "+domName);
			}
			for (var i = 0; i < recordsFilter.length; i++) {
				dataSet.push({
					"domain": recordsFilter[i]['domain'],
					"date": '<span style="display: none;">' + recordsFilter[i].visitTime + ' -- ' + moment(recordsFilter[i].visitTime).format('MMM D, YYYY - h A') + '</span>' + moment(recordsFilter[i].visitTime).format('llll'),
					"title": recordsFilter[i].title,
					"url": '<a href="'+recordsFilter[i].url+'" target="_blank">'+recordsFilter[i].url+'</a>',
					"rawUrl": recordsFilter[i].url
				});
				
				var domain = recordsFilter[i]['domain'];
				
				if (domainCounts[domain] == undefined) {
					domainCounts[domain] = 0;
					
					domainList.push(domain);
				}
				
				domainCounts[domain] += 1;
			}

			var domainDataSet = [];
			
			for (var i = 0; i < domainList.length; i++) {
				
				domainDataSet.push({
					domain: domainList[i],
					visits: domainCounts[domainList[i]]
				});
			}

			$(pagesSelector).click(function(e) {
				e.preventDefault();
				
				$(toolbarSelector + " li").removeClass("active");
				$(e.target).parent().addClass("active");

				$(selector).bootstrapTable("destroy");
				
				$(selector).bootstrapTable({
					columns: [{
						field: 'remove',
						title: '<a href="#" id="delete_pages"><span class="glyphicon glyphicon-trash" aria-hidden="true" style="color:red"></span></a>',
						checkbox: true,
						sortable: false
					}, {
						field: 'domain',
						title: 'Domain',
						sortable: true
					}, {
						field: 'date',
						title: 'Date',
						sortable: true
					}, {
						field: 'title',
						title: 'Title',
						sortable: true
					}, {
						field: 'url',
						title: 'URL',
						sortable: false,
					}],
					data: dataSet,
					striped: true,
					pagination: true,
					search: true,
					sortable: true,
					checkboxHeader: false,
					toolbar: toolbarSelector,
					onPostBody: function (data) {
						if (canDelete) {
							$("a#delete_pages").click(function(e) {
								console.log("CLICK");
								e.preventDefault();
							
								var selected = $(selector).bootstrapTable("getSelections");

								console.log("SELECTED");
								console.log(selected.length);
							
								if (selected.length == 0) {
							
								} else {
									var urlCount = selected.length;
								
									$("#confirm_modal_title").html("Remove URLs?");
									$("#confirm_modal_body").html("Would you like to remove the selected pages from Web Historian?");
									$("#confirm_modal_cancel").html("No");
									$("#confirm_modal_confirm").html("Yes");
							
									$("#confirm_modal_confirm").off("click");
							
									$("#confirm_modal_confirm").click(function(e) {
										var toDelete = [];
									
										for (var i = 0; i < selected.length; i++) {
										    console.log("SELECTED: " + JSON.stringify(selected[i], 2));
										    
											if (toDelete.indexOf(selected[i]['rawUrl']) == -1) {
												console.log("RAW URL: " + selected[i]['rawUrl']);
												toDelete.push(selected[i]['rawUrl']);
											}
										}
									
										database.clearUrls(toDelete, function() {
											database.logEvent("urls_deleted", { 'count': urlCount });

											$("#confirm_modal").modal("hide");

											$(selector).bootstrapTable("destroy");
									
											visualization.display(selector, pagesSelector, domainsSelector, toolbarSelector, canDelete);
										});
									});

									$("#confirm_modal").modal("show");
								}
							});
						}
					}
				});			

				if (canDelete == false) {
					$(selector).bootstrapTable("hideColumn", "remove");
				}
            });

			$(domainsSelector).click(function(e) {
				e.preventDefault();
		
				$(toolbarSelector + " li").removeClass("active");
				$(e.target).parent().addClass("active");
				
				$(selector).bootstrapTable("destroy");
				
				$(selector).bootstrapTable({
					columns: [{
						field: 'remove',
						title: '<a href="#" id="delete_domains"><span class="glyphicon glyphicon-trash" aria-hidden="true" style="color:red"></span></a>',
						checkbox: true,
						sortable: false
					}, {
						field: 'domain',
						title: 'Domain',
						sortable: true
					}, {
						field: 'visits',
						title: 'Visits',
						sortable: true,
					}],
					data: domainDataSet,
					striped: true,
					pagination: true,
					search: true,
					sortable: true,
					checkboxHeader: false,
					toolbar: toolbarSelector,
					onPostBody: function (data) {
						$("a#delete_domains").click(function(e) {
							e.preventDefault();
							
							var selected = $(selector).bootstrapTable("getSelections");
							
							if (selected.length == 0) {
							
							} else {
								var domainCount = selected.length;
								
								$("#confirm_modal_title").html("Remove domains?");
								$("#confirm_modal_body").html("Would you like to remove the selected domains from Web Historian?");
								$("#confirm_modal_cancel").html("No");
								$("#confirm_modal_confirm").html("Yes");
							
								$("#confirm_modal_confirm").off("click");
							
								$("#confirm_modal_confirm").click(function(e) {
									var toDelete = [];
									
									for (var i = 0; i < selected.length; i++) {
										if (toDelete.indexOf(selected[i]['domain']) == -1) {
											toDelete.push(selected[i]['domain']);
										}
									}
									
									database.clearDomains(toDelete, function() {
										database.logEvent("domains_deleted", { 'count': domainCount });

										$("#confirm_modal").modal("hide");

										$(selector).bootstrapTable("destroy");
									
										visualization.display(selector, pagesSelector, domainsSelector, toolbarSelector, canDelete);
									});
								});

								$("#confirm_modal").modal("show");
							}
						});
					}
				});

				if (canDelete == false) {
					$(selector).bootstrapTable("hideColumn", "remove");
				}
			});

	        $(pagesSelector).click();

			$("#loading_modal").modal("hide");
        });
    };
    
    return visualization;
});