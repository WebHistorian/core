define(["core/utils", "app/config", "core/database", "moment", "d3-context-menu", "nouislider"], function(utils, config, database, moment, context, noUiSlider) {
    var visualization = {};
    
	visualization.latest = new Date();
	visualization.earliest = new Date(0);

    visualization.end = visualization.latest;
    visualization.start = new Date(visualization.end.getTime() - (7 * 24 * 60 * 60 * 1000));

    function searchWebsites(query) {
        var theNodes = d3.selectAll(".node").filter(function(d) {
            var re = new RegExp(query, "gi");
            return d.className.match(re);
        });
        console.log("matches: " + theNodes[0].length);
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

    visualization.display = function(selector, menu, sliderSelector, earliest) {
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

				visualization.display(selector, menu, sliderSelector, earliest);
			});
		} else {
			visualization.slider.set([sliderStart, sliderEnd]);
		}
        
        $(selector).empty();

        database.fetchCategories(function(categories) {
        	database.fetchRecords(visualization.start, visualization.end, function(data) {
				var termArray = utils.generateTerms(data);

				var sortedTerms = utils.sortByProperty(termArray, "term");

				var uniqueTerms = utils.uniqueCountST(sortedTerms, "term");

				var allSearchWords = utils.searchTermsToWords(uniqueTerms);

				var sortedAllWords = utils.sortByProperty(allSearchWords, "word");

				var searchWords = utils.searchWordsFun(sortedAllWords, uniqueTerms);

				var maxCount = Math.max.apply(Math, searchWords.map(function(searchWords) {
					return searchWords.size;
				}));
				
				if (menu == null) {
					menu = [
						{
							title: 'Permanently Delete',
							action: function(d) {
								if (confirm('Do you want to PERMANENTLY remove all URLs with the search term \"'+d.__data__.text+'\" from your local browser history?')) {
									//filter the dataset to just the search word specified
									var all = utils.sortByProperty(history.fullData,"url");
									var newHist = [];
									var removal = [];
									var vc = 1;

									all.forEach(function (a,b) {
										var terms = a.searchTerms;
										var re = new RegExp(".*"+d.__data__.text+".*","i");
										var hit = re.test(terms);

										if (hit === true){
											if(a.url != b.url){
												removal.push({url: a.url, visitCount: vc});
											} else {
												vc = vc+1;
											}
										} else {
											newHist.push(a);
										}
									});
									if (removal === null){
										alert("No URLs were removed. ");
									} else {
										$(".wh-tooltip").remove();
										utils.removeHistory(removal);
										history.fullData = utils.sortByProperty(newHist,"date");
										visualization.display(history, history.fullData);
									}
								}
							}
						}
					];
				}

				d3.select("#" + history.timeSelection).classed("active", true);

				function draw(words) {
					var svgNode = d3.select(selector).append("svg")
						.attr("width", width)
						.attr("height", height)
						.attr("id", "visualization")
						.append("g")
						.attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")")
						.selectAll("text")
						.data(words)
						.enter().append("text")
						.style("font-size", function(d) {
							return d.size + "px";
						})
						.style("font-family", "Impact")
						.style("fill", function(d, i) {
							return fill(i);
						})
						.attr("text-anchor", "middle")
						.attr("transform", function(d) {
							return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
						})
						.text(function(d) {
							return d.text;
						})
						.on("mouseover", function(d) {
							if (menu.length > 0) {
								tooltip.text("Search terms including \"" + d.text + "\": " + d.allTerms);
							} else {
								tooltip.text("Search terms including \"" + d.text + "\": " + d.allTerms + "");
							}
							
							tooltip.style("visibility", "visible");
						})
						.on("mousemove", function() {
							return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
						})
						.on("mouseout", function() {
							return tooltip.style("visibility", "hidden");
						})
						
						if (menu.length > 0) {
							svgNode.on("contextmenu", d3.contextMenu(menu, function(){
								tooltip.style("visibility", "hidden");
							}));
						}
				}

				var width = $(selector).width();
				var height = $(selector).height();
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

				var fill = d3.scale.category20();
					d3.layout.cloud().size([width, height])
					.words(searchWords)
					.padding(5)
					.rotate(function() {
						return 0;
					})
					.font("Impact")
					.fontSize(function(d) {
						var fontSizeCalc = d.size / maxCount;
						return utils.log10(fontSizeCalc * 140) * 2;
					})
					//.fontSize(function(d) { return d.size * 20 })
					.on("end", draw)
					.start();

				$("#loading_modal").modal("hide");
        	});
        });
    };
    
    return visualization;
});