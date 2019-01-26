define(["core/utils", "app/config", "core/database", "moment", "d3-context-menu", "nouislider"], function(utils, config, database, moment, context, noUiSlider) {
  var visualization = {};
    
  visualization.latest = new Date();
	visualization.earliest = new Date(0);

	visualization.end = visualization.latest;
	visualization.start = visualization.earliest; //new Date(visualization.end.getTime() - (7 * 24 * 60 * 60 * 1000));

	visualization.catData = function(data, categories, callback) {
		var specified = []; //domainExact
		var domS = []; //domainSearch - not yet implemented
		var top = []; //topDomainExact

		for (var i in categories) {
			if (categories[i].search === "domainExact") {
				specified.push({
					domain: categories[i].value,
					category: categories[i].category
				});
			} else if (categories[i].search === "domainSearch") {
				domS.push({
					value: categories[i].value,
					category: categories[i].category
				});
			} else if (categories[i].search === "topDomainExact") {
				top.push({
					value: categories[i].value,
					category: categories[i].category
				});
			}
		}
	
		var catU = utils.countsOfProperty(categories, "category");

		var catObj = {
			specified: specified,
			domS: domS,
			top: top,
			catU: catU
		};

		return callback(data, catObj, intoData);
	};

	//get the data from different view options into the tree/flare type object
	function intoData(catObj, domains) {
		var realData = {
			name: "Domains",
			children: []
		};
		for (var i in catObj.catU) {
			realData.children.push({
				name: catObj.catU[i].counter,
				children: []
			});
			catName = catObj.catU[i].counter;
			noSpCat = catName.replace(/\s+/g, '');
			$('#explore_visits_category').append("<option id='"+noSpCat+"'>"+catName+"</option>");
			//works: console.log('category: ',catObj.catU[i].counter,' count: ',catObj.catU[i].count);
		}
		for (var count in domains) {
			var domainName = domains[count].domain;
			var size = domains[count].count;
			var topD = domains[count].topD;
			if (utils.objContains(catObj.specified, "domain", domainName)) {
				for (var i in catObj.specified) {
					if (domainName === catObj.specified[i].domain) {
						var catId = utils.findIndexByKeyValue(realData.children, "name", catObj.specified[i].category);
						realData.children[catId].children.push({
							name: domainName,
							size: size
						});
					}
				}
			} //domainSearch - catObj.domS logic goes here
			else if (utils.objContains(catObj.top, "value", topD)) {
				for (var i in catObj.top) {
					if (topD === catObj.top[i].value) {
						var catId = utils.findIndexByKeyValue(realData.children, "name", catObj.top[i].category);
						realData.children[catId].children.push({
							name: domainName,
							size: size
						});
					}
				}
			} else {
				var catId1 = utils.findIndexByKeyValue(realData.children, "name", "Other");
				realData.children[catId1].children.push({
					name: domainName,
					size: size
				});
			}
		}
		return realData;
	}

	//simplest view, just a count of visits
	function getVisitData(data, categories, callback) {
		var domains = utils.countPropDomains(data, "domain");
		return callback(categories, domains);
	};

	//habits view needs processing to segment by day
	function getHabitData(data, categories, callback) {
		var biggestSize = 0;
		var biggestDomain = null;
		
		var domains = utils.countPropDomains(data, "domain");

		for (var i = 0; i < domains.length; i++) {
			var domain = domains[i];
		
			var days = [];

			for (var j = 0; j < data.length; j++) {
				if (domain.domain === data[j].domain) {
					var dayStart = Math.floor(data[j].visitTime / (24 * 60 * 60 * 1000));

					if (days.indexOf(dayStart) == -1) {
						days.push(dayStart);
					}
				}
			}

			var size = days.length;

			if (size >= biggestSize) {
				biggestSize = size;
				biggestDomain = domain.domain;
			}
		
			domain['count'] = size;
		}

		return callback(categories, domains);
	};

	function searchWebsites(query) {
		var theNodes = d3.selectAll(".node").filter(function(d) {
			var re = new RegExp(query, "gi");
			return d.className.match(re);
		});

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

	visualization.display = function(selector, menu, startVisitDisplay, sliderSelector, typeSelector, searchSelector, earliest) {
		$("#loading_modal").modal("show");

		visualization.earliest = earliest;
		
		var change = 0;
	
		$(selector).empty();

		var rangeStart = Math.floor(visualization.earliest.getTime() / (24 * 60 * 60 * 1000));
		var rangeEnd = Math.floor(visualization.latest.getTime() / (24 * 60 * 60 * 1000));
		
		var sliderStart = Math.floor(visualization.start.getTime() / (24 * 60 * 60 * 1000));
		var sliderEnd = Math.floor(visualization.end.getTime() / (24 * 60 * 60 * 1000));
		
		if (visualization.slider == undefined) {
			visualization.slider = noUiSlider.create($(sliderSelector).get(0), {
				start: [sliderStart, sliderEnd],
				connect: true,
				range: {
					'min': rangeStart,
					'max': rangeEnd
				}
			});
			
			$(".visits_slider_latest").html(moment(visualization.end.getTime()).format('MMM D'));
			$(".visits_slider_earliest").html(moment(visualization.start.getTime()).format('MMM D'));
			
			visualization.slider.on('update', function(){
				var values = visualization.slider.get();

				$(".visits_slider_latest").html(moment(values[1] * (24 * 60 * 60 * 1000)).format('MMM D'));
				$(".visits_slider_earliest").html(moment(values[0] * (24 * 60 * 60 * 1000)).format('MMM D'));
			});

			visualization.slider.on('end', function(){
				var values = visualization.slider.get();

				visualization.start = new Date(values[0] * (24 * 60 * 60 * 1000));
				visualization.end = new Date((values[1] + 1) * (24 * 60 * 60 * 1000));

				visualization.display(selector, menu, startVisitDisplay, sliderSelector, typeSelector, searchSelector, earliest);
			});
		} else {
			visualization.slider.set([sliderStart, sliderEnd]);
		}
	
		database.fetchCategories(function(categories) {
			database.fetchRecords(visualization.start, visualization.end, function(data) {
				var datasetV = visualization.catData(data, categories, getVisitData);
				var datasetH = visualization.catData(data, categories, getHabitData);

				//constant visual elements

				var r = $(selector).height(),
					format = d3.format(",d"),
					fill = d3.scale.category20();

				var bubble = d3.layout.pack()
					.sort(null)
					.size([r, r])
					.padding(1.5);
			
				var tooltip = d3.select("body")
					.append("div")
					.style("position", "absolute")
					.style("z-index", "10")
					.style("visibility", "hidden")
					.style("color", "white")
					.style("padding", "8px")
					.style("background-color", "rgba(0, 0, 0, 0.75)")
					.style("border-radius", "6px")
					.style("font", "12px sans-serif")
					.text("tooltip")
					.attr("class", "wh-tooltip");

				var vis = d3.select(selector).append("svg")
					.attr("width", r)
					.attr("height", r)
					.attr("class", "bubble")
					.attr("id", "visualization");

				function showVisits() {
					habits = 0;
					change = 1;
					$("select[name='category']>option:eq(0)").prop('selected', true);
					var numDomains = utils.countUniqueProperty(data, "domain");
//					$("#title").html("<h1 id='viz_title'>What websites do you visit most?</h1>");
//					$("#above_visual").html("<div class='btn-group' data-toggle='buttons'> <label class='btn btn-primary active'> <input type='radio' name=\"options\" id=\"visits\" autocomplete=\"off\" checked> All Visits  </label> <label class=\"btn btn-primary\"> <input type=\"radio\"name=\"options\" id=\"habits\" autocomplete=\"off\"> Daily Habits  </label></div> &nbsp; &nbsp; <input type='text' id='searchBox'><input type='button' id='search' value='website search'/> &nbsp; " + aboveTxt + "<p><br/> <input type='text' id='slider' name='slider_name' value=''/>");
					changeBubble(datasetV);
				}

				function showHabits() {
					habits = 1;
					change = 1;
					$("select[name='category']>option:eq(0)").prop('selected', true);
					changeBubble(datasetH);
				}
				function showCat(catSelected) {
					if(habits==1){
						var datasetCH = {};
						$.each(datasetH.children, function(i){
						    if (this.name == catSelected) {
								datasetCH = {name: "Domains", children:[{name: catSelected, children: this.children}]};
							}
						});
						changeBubble(datasetCH);
					} else {
						var datasetCV = {};
						$.each(datasetV.children, function(i){
						    if (this.name == catSelected) {
								datasetCV = {name: "Domains", children:[{name: catSelected, children: this.children}]};
							}
						});
						changeBubble(datasetCV);
					}	
				}

				function listenView() {
					$("select[name='visit_type']").on("change", function() {
						var selected = $("select[name='visit_type'] option:selected");
						var selectedId = selected.attr("id");
					
						if (selectedId === "habits") {
							showHabits();
						} else if (selectedId === "visits") {
							showVisits();
						}
					});
					$("select[name='category']").on("change", function() {
						var selectCat = $("select[name='category'] option:selected");
						var selectedCat = selectCat.text();
						showCat(selectedCat);
					});
				
					$(searchSelector).click(function() {
						searchWebsites(document.querySelector('#visit_search').value);
					});
					
					$(searchSelector).bind("enterKey", function(e) {
						searchWebsites(document.querySelector('#visit_search').value);
					});
					$(searchSelector).keyup(function(e) {
						if (e.keyCode == 13) {
							$(this).trigger("enterKey");
						}
					});

					var timeoutID = null;

					$(searchSelector).keyup(function() {
						clearTimeout(timeoutID);
						var $searchBox = $(this);
						timeoutID = setTimeout(function() {
							searchWebsites($searchBox.val());
						}, 500);
					});
				}
			
				window.setTimeout(function() {
					$(".progress").hide();
					if (startVisitDisplay) {
						$(typeSelector + " option[id='visits']").prop("selected", "selected");
						showVisits();
					} else { 
						$(typeSelector + " option[id='habits']").prop("selected", "selected");
						showHabits();
					}
				}, 100);

				//update function
				function changeBubble(dataset) {
					listenView();
					
					var siteClasses = utils.classes(dataset);

					var node = vis.selectAll(".node")
						.data(bubble.nodes(siteClasses)
							.filter(function(d) {
								return !d.children;
							}),
							function(d) {
								return d.className;
							});

					var nodeEnter = node.enter()
						.append("g")
						.attr("class", "node")
						.attr("transform", function(d) {
							return "translate(" + d.x + "," + d.y + ")";
						});

					nodeHighlight = false;
				
					if (menu == null) {
						menu = [{
								title: chrome.i18n.getMessage("wvMenu1Title"),
								action: function(d) {
									//filter the dataset to just the domain of the object
									var all = history.fullData;
									var dv = [];
									for (var i in all) {
										var domain = all[i].domain;
										var item = all[i];
										if (domain === d.__data__.className) {
											dv.push(item);
										}
									}
									requirejs(["app/data-table"], function(data_table) {
										data_table.display(history, dv, "");
										$(".wh-tooltip").remove();
										$("#viz_title").text(chrome.i18n.getMessage("wvMenu1VizTitle") + d.__data__.className);
										$("#title h2").append(chrome.i18n.getMessage("wvMenu1SubTitle"));
										vizSelected = "data_table";
										document.body.scrollTop = document.documentElement.scrollTop = 0;
									});
								},
								disabled: false
							},
							{
								title: chrome.i18n.getMessage("wvMenu2Title"),
								action: function(d) {
									//filter the dataset to just the domain of the object
									var all = history.fullData;
									var dv = [];
									for (var i in all) {
										var domain = all[i].domain;
										var item = all[i];
										if (domain === d.__data__.className) {
											dv.push(item);
										}
									}
									requirejs(["app/time"], function(time) {
										time.display(history, dv);
										$(".wh-tooltip").remove();
										$("#viz_title").text(chrome.i18n.getMessage("wvMenu2VizTitle") + d.__data__.className);
										$("#title h2").text(chrome.i18n.getMessage("wvMenu2SubTitle"));
										vizSelected = "time";
										document.body.scrollTop = document.documentElement.scrollTop = 0;
									});
								},
								disabled: false
							},
							{
								title: chrome.i18n.getMessage("wvMenu3Title"),
								action: function(d) {
									if (confirm(chrome.i18n.getMessage("wvMenu3Confirm1") + d.__data__.className + chrome.i18n.getMessage("wvMenu3Confirm2"))) {
										$(".wh-tooltip").remove();
										//filter the dataset to just the domain of the object
										var all = utils.sortByProperty(history.fullData, "url");
										var newHist = [];
										var removal = [];
										var vc = 1;
										all.forEach(function(a, b) {
											if (a.domain === d.__data__.className) {
												if (a.url != b.url) {
													removal.push({
														url: a.url,
														visitCount: vc
													});
												} else {
													vc = vc + 1;
												}
											} else {
												newHist.push(a);
											}
										});
										utils.removeHistory(removal);

										history.fullData = utils.sortByProperty(newHist, "date");
										visualization.display(history, history.fullData);
									}
								}
							}
						]
					}

					nodeEnter
						.append("circle")
						.attr("r", function(d) {
							return d.r;
						})
						.style("fill", function(d) {
							return fill(d.packageName);
						})
						.on("click", function(d) {
							d3.select(this).style({
								fill: "yellow",
								stroke: "#a6a6a6",
								"stroke-width": "2px"
							});
						})
						.on("dblclick", function(d) {
							d3.select(this).style("fill", function(d) {
								return fill(d.packageName);
							});
							d3.select(this).style("stroke-width", "0px");
						})
						.on("mouseover", function(d) {
							if (habits === 0) {
								tooltip.text(d.className + chrome.i18n.getMessage("wvTooltip1") + format(d.value) + chrome.i18n.getMessage("wvTooltip2") + d.packageName + chrome.i18n.getMessage("wvTooltip3"));
							} else if (habits === 1) {
								//var percentDays = Math.round((d.value/diffDays) * 100);
								tooltip.text(d.className + chrome.i18n.getMessage("wvTooltip4") + format(d.value) + chrome.i18n.getMessage("wvTooltip5") + d.packageName);
							}
							tooltip.style("visibility", "visible");
						})
						.on("mousemove", function() {
							return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
						})
						.on("mouseout", function() {
							return tooltip.style("visibility", "hidden");
						});
					
					if (menu.length > 0) {
						nodeEnter.on("contextmenu", d3.contextMenu(menu, function() {
							tooltip.style("visibility", "hidden");
						}));
					}

					nodeEnter
						.append("text")
						.attr("pointer-events", "none")
						.attr("text-anchor", "middle")
						.attr("dy", ".3em")
						.text(function(d) {
							return d.className.substring(0, d.r / 3);
						});

					node.transition().attr("class", "node")
						.transition().duration(5000)
						.attr("transform", function(d) {
							return "translate(" + d.x + "," + d.y + ")";
						});
					node.select("circle")
						.transition().duration(2000)
						.attr("r", function(d) {
							return d.r;
						});
					node.select("text")
						.transition().duration(5000)
						.attr("text-anchor", "middle")
						.attr("dy", ".3em")
						.text(function(d) {
							return d.className.substring(0, d.r / 3);
						});
					
					node.exit().remove();
					
					$("#loading_modal").modal("hide");
				}
			});
		});
	};
    
    return visualization;
});