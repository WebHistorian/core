define(["core/utils", "app/config", "core/database", "moment", "d3-context-menu", "nouislider"], function(utils, config, database, moment, context, noUiSlider) {
    var visualization = {};

    visualization.latest = new Date();
	visualization.earliest = new Date(0);

	visualization.end = visualization.latest;
	visualization.start = new Date(visualization.end.getTime() - (7 * 24 * 60 * 60 * 1000));

    visualization.display = function(selector, menu, sliderSelector, earliest) {
        var change = 0;

		$("#loading_modal").modal("show");

		visualization.earliest = earliest;
        
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
			
			$(sliderSelector + "_latest").html(moment(visualization.end.getTime()).format('MMM D'));
			$(sliderSelector + "_earliest").html(moment(visualization.start.getTime()).format('MMM D'));
			
			visualization.slider.on('update', function(){
				var values = visualization.slider.get();

				$(sliderSelector + "_latest").html(moment(values[1] * (24 * 60 * 60 * 1000)).format('MMM D'));
				$(sliderSelector + "_earliest").html(moment(values[0] * (24 * 60 * 60 * 1000)).format('MMM D'));
			});

			visualization.slider.on('end', function(){
				var values = visualization.slider.get();

				visualization.start = new Date(values[0] * (24 * 60 * 60 * 1000));
				visualization.end = new Date((values[1] + 1) * (24 * 60 * 60 * 1000));

				$(sliderSelector + "_latest").html(moment(values[1] * (24 * 60 * 60 * 1000)).format('MMM D'));
				$(sliderSelector + "_earliest").html(moment(values[0] * (24 * 60 * 60 * 1000)).format('MMM D'));

				visualization.display(selector, menu, sliderSelector, earliest);
			});
		} else {
			visualization.slider.set([sliderStart, sliderEnd]);
		}
		
        database.fetchCategories(function(categories) {
        	database.fetchRecords(visualization.start, visualization.end, function(data) {
				var specified = []; //domainExact
				var topD = []; //topDomainExact
				var color = d3.scale.category20c();

				for (var i = 0; i < categories.length; i++) {
					if (categories[i].search === "domainExact"){
						specified.push({
							domain: categories[i].value, 
							category: categories[i].category
						});
					}
					else if (categories[i].search === "topDomainExact") {
						topD.push({
							value: categories[i].value, 
							category: categories[i].category
						});
					}
				}

				var allEdges = [];
				var uniqueEdges = [];
				var edgeList = [];
				var sorted = [];
				
				if (menu == null) {
					menu = [
						{
							title: chrome.i18n.getMessage("wnMenu1Title"),
							action: function(d) {
								if (confirm(chrome.i18n.getMessage("wnMenu1Confirm1") + d.__data__.name + chrome.i18n.getMessage("wnMenu1Confirm2"))) {
									$(".wh-tooltip").remove();

									//filter the dataset to just the domain of the object

									var all = utils.sortByProperty(history.fullData,"url");
									var newHist = [];
									var removal = [];

									var vc = 1;
									all.forEach(function (a,b) {
										if (a.domain === d.__data__.name) {
											if(a.url != b.url){
												removal.push({url: a.url, visitCount: vc});
											} else {
												vc = vc+1;
											}
										} else {
											newHist.push(a);
										}
									});
							
									utils.removeHistory(removal);

									history.fullData = utils.sortByProperty(newHist,"date");
									visualization.display(history, history.fullData);
								}
							}
						}
					];
				}
				
				for (var i = 1; i < data.length; i++) {
					var dataItem = data[i];
					var domain = dataItem.domain;
					var transition = dataItem.transition;
					var time = dataItem.visitTime;

					if (transition === "link") {
						//find the chronogically previous item 
						var prevItem = data[i - 1];

						if (prevItem !== undefined) {
							var prevDomain = prevItem.domain;
							var prevTime = prevItem.visitTime;
							var offsetSec = 5 * 60 * 1000; //5 minutes in milleseconds
							var diffTime = time - prevTime;

							if (prevDomain !== domain && prevDomain !== undefined && diffTime < offsetSec) {
								allEdges.push({
									sort: prevDomain + domain,
									source: prevDomain,
									target: domain
								});
							}
						}
					}
				}

				sorted = allEdges.sort(function(a, b) {
					if (a.sort < b.sort)
						return -1;

					if (a.sort > b.sort)
						return 1;

					return 0;
				});

				totalLinks = allEdges.length + 1;

				var countEdges = 1;

				for (var j = 0; j < sorted.length; j++) {
					var sortedItem = sorted[j];
					var countThing = sorted[j].sort;
					var sourceItem = sorted[j].source;
					var targetItem = sorted[j].target;

					var nextCountThing = "";

					if (j < sorted.length - 1) {
						nextCountThing = sorted[j + 1].sort;
					}

					if (countThing === nextCountThing) {
						countEdges++;
					} else { //if (countEdges >= 2)
						edgeList.push({
							source: sourceItem,
							target: targetItem,
							value: countEdges
						});
						countEdges = 1;
					}
				}

				// Network visualization based on  http://www.d3noob.org/2013/03/d3js-force-directed-graph-example-basic.html and http://bl.ocks.org/mbostock/3750558

				d3.select("#" + history.timeSelection).classed("active", true);

				var numSites = edgeList.length + 1;

				var nodes = {};
				var edgesMaxValue = 0;

				function cat(domain){

				}

				// Compute the distinct nodes from the links.
				edgeList.forEach(function(link) {
					var catSource = "Other";
					var catTarget = "Other";
					var catIdSource = utils.findIndexByKeyValue(specified,"domain",link.source);
					var catIdTarget = utils.findIndexByKeyValue(specified,"domain",link.target);
					var sourceTopD = utils.topD(link.source);
					var targetTopD = utils.topD(link.target);
					var catIdSourceTopD = utils.findIndexByKeyValue(topD,"value",sourceTopD);
					var catIdTargetTopD = utils.findIndexByKeyValue(topD,"value",targetTopD);

					if (catIdSource != null) {
						catSource = specified[catIdSource].category;
					} else if (catIdSourceTopD != null) {
						catSource = topD[catIdSourceTopD].category;
					}

					if (catIdTarget != null){
						catTarget = specified[catIdTarget].category;
					} else if (catIdTargetTopD != null){
						catTarget = topD[catIdTargetTopD].category;
					}

					link.source = nodes[link.source] || (nodes[link.source] = {
						name: link.source,
						category: catSource
					});
					
					link.target = nodes[link.target] || (nodes[link.target] = {
						name: link.target,
						category: catTarget
					});
					
					link.value = +link.value;

					if (edgesMaxValue < link.value) {
						edgesMaxValue = link.value;
					}
				});

				var width = $(selector).width();
				var height = $(selector).height();
//				var height = width * .7;
//
//				$("#visual_div").height(height);

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

				var force = d3.layout.force()
					.nodes(d3.values(nodes))
					.links(edgeList)
					.size([width, height])
					.linkDistance(30)
					.chargeDistance(100)
					.charge(-1000)
//					.charge(function(d){
//						console.log("W: " + d.weight);
//						
//						if (d.weight > 2){
//							return -30 - Math.log2(d.weight);
//						}
//						else {
//							return -30;
//						}
//					})
					.gravity(0.4)
					.on("tick", tick)
					.start();

				var svg = d3.select(selector).append("svg")
					.attr("width", width)
					.attr("height", height)
					.attr("id", "visualization");

				var drag = force.drag().on("dragstart", dragstart);

				function dblclick(d) {
					d3.select(this).classed("fixed", d.fixed = false);
				}

				function dragstart(d) {
					d3.select(this).classed("fixed", d.fixed = true);
				}

				// build the arrow.
				svg.append("svg:defs").selectAll("marker")
					.data(["end"]) // Different link/path types can be defined here
					.enter().append("svg:marker") // This section adds in the arrows
					.attr("id", String)
					.attr("viewBox", "0 -5 10 10")
					.attr("refX", 10)
					.attr("refY", -1.5)//1.5
					.attr("markerWidth", 5)
					.attr("markerHeight", 5)
					.attr("orient", "auto")
					.attr("class", "marker")
					.append("svg:path")
					.attr("d", "M0,-5L10,0L0,5");

				// add the links and the arrows
				var path = svg.append("svg:g").selectAll("path")
					.data(force.links())
					.enter().append("svg:path")
					.style("userSpaceOnUse", 1.5)
					.attr("class", "link")
					.attr("marker-end", "url(#end)");

				// define the nodes
				var node = svg.selectAll(".node")
					.data(force.nodes())
					.enter().append("g")
					.attr("class", "node")
					.on("dblclick", dblclick)
					.on("mouseover", function(d){
						if (menu.length > 0) {
							tooltip.text(d.name + chrome.i18n.getMessage("wnTooltip1") + d.category);
						} else {
							tooltip.text(d.name + chrome.i18n.getMessage("wnTooltip1") + d.category + ".");
						}
						
						tooltip.style("visibility", "visible");
					})
					.on("mousemove", function() {
						return tooltip.style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");
					})
					.on("mouseout", function(){
						return tooltip.style("visibility", "hidden");
					})
					.call(drag);

				if (menu.length > 0) {
					node.on("contextmenu", d3.contextMenu(menu, function(){
						tooltip.style("visibility", "hidden");
					}));
				}

				// add the nodes
				node.append("circle")
					.attr("r", function(d) { 
						d.radius = (Math.log(d.weight) + .7) * 4;
						return d.radius;
					})
					.attr("class", "network")
					.style("fill", function(d) { 
						return color(d.category); 
					});

				// add the curvy lines
				function tick(e) {
					var no = d3.values(nodes);
					var q = d3.geom.quadtree(no),
					i = 0,
					n = no.length;

					while (++i < n) q.visit(collide(no[i]));

					path.attr("d", function(d) {
						var dx = d.target.x - d.source.x,
						dy = d.target.y - d.source.y,
						dr = Math.sqrt(dx * dx + dy * dy);

						// x and y distances from center to outside edge of target node
						offsetX = (dx * d.target.radius) / dr;
						offsetY = (dy * d.target.radius) / dr;

						placeX = (d.target.x - offsetX)
						placeY = (d.target.y - offsetY)

						//keep paths in the svg
						var px = Math.max(1, Math.min(width, d.source.x)); 
						var py = Math.max(1, Math.min(height, d.source.y));

						return "M" +
						px + "," +
						py + "A" +
						dr + "," + dr + " 0 0,1 " + placeX + "," + placeY;
					});

					node.attr("transform", function(d) {
						//keep nodes in the svg
						var dx = Math.max(d.radius, Math.min(width - d.radius, d.x))
						var dy = Math.max(d.radius, Math.min(height - d.radius, d.y))
						return "translate(" + dx + "," + dy + ")";
					});
				}

				function collide(node) {
					var r = node.radius + 16,
					nx1 = node.x - r,
					nx2 = node.x + r,
					ny1 = node.y - r,
					ny2 = node.y + r;
					return function(quad, x1, y1, x2, y2) {
						if (quad.point && (quad.point !== node)) {
							var x = node.x - quad.point.x,
							y = node.y - quad.point.y,
							l = Math.sqrt(x * x + y * y),
							r = node.radius + quad.point.radius;

							if (l < r) {
								l = (l - r) / l * .5;
								node.x -= x *= l;
								node.y -= y *= l;
								quad.point.x += x;
								quad.point.y += y;
							}
						}
						
						return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
					};
				};

				$("#search").click(function(){
					searchWebsites(document.querySelector('#searchBox').value);
				});

				$('#searchBox').bind("enterKey",function(e){
					searchWebsites(document.querySelector('#searchBox').value);
				});

				$('#searchBox').keyup(function(e){
					if(e.keyCode == 13) {
						$(this).trigger("enterKey");
					}
				});

				var timeoutID = null;

				function findMember(str) {
					console.log('search: ' + str);
				}

				$('#searchBox').keyup(function() {
					clearTimeout(timeoutID);
					//var $searchBox = $(this);
					var val = document.querySelector('#searchBox').value;
					timeoutID = setTimeout(function() { 
						searchWebsites(val); 
					}, 500); 
				});

				$("#loading_modal").modal("hide");
        	});
        });
    };
    
    return visualization;
});