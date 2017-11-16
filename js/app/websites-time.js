define(["core/utils", "app/config", "core/database", "moment", "d3-context-menu", "nouislider"], function(utils, config, database, moment, context, noUiSlider) {
    var visualization = {};
    
    var hourLength = 60 * 60 * 1000;
    var dayLength = 24 * hourLength;
    
    visualization.latest = new Date();
	visualization.earliest = new Date(0);

	visualization.end = visualization.latest;
	visualization.start = new Date(visualization.end.getTime() - (7 * 24 * 60 * 60 * 1000));

    function weekMenu() {
        var se = JSON.parse(sessionStorage.getItem("se"));
        var start = visualization.start;
        var end = visualization.end;
        var startYear = parseInt(moment(start).format('YYYY'));
        var startDay = parseInt(moment(start).format('DDD'));
        var endYear = parseInt(moment(end).format('YYYY'));
        var endDay = parseInt(moment(end).format('DDD'));

        if (endYear !== startYear) {
            endDay = endDay + 365;
        }

        var daySpan = endDay - startDay;
        var fullWeeks = Math.floor(daySpan/7);

        $("#weekMenu").append("<li role='presentation'><a id='allData' role='menuitem' href='#'>All "+fullWeeks+" Weeks</a></li><li role='presentation' class='divider'></li>");

        $("#allData").click(function() {
            if(weekSelectedId !== "all") {
                weekSelectedId = "all";
                visualization.display(history, history.fullData);
                $("#title h2").text("Browsing by hour of the day &amp; day of the week, " + moment(start).format('ddd, MMM D') + " - "+ moment(end).format('ddd, MMM D'));
            }
        });

        $("#weekMenu").append("<li role='presentation'><a id='thisWeek' role='menuitem' href='#'>This Week - Default</a></li>");

        $("#thisWeek").click(function() {
            if(weekSelectedId !== "0") {
                weekSelectedId = "0";
                var sevenDaysAgo = utils.lessDays(now, 7);
                var weekData = utils.filterByDates(history.fullData, sevenDaysAgo, now);
//              visualization.display(history, weekData);
            }
        });

        function substractDateFromIndex(i){
            var subtractStart = i * 7;
            var subtractEnd = subtractStart + 7;
            var subtractStartD = subtractStart + 1;
            var startWeek = utils.lessDays(end,subtractStart);
            var endWeek = utils.lessDays(end,subtractEnd);
            var startWeekD = utils.lessDays(end,subtractStartD);
            var startWeekDisplay = moment(startWeekD).format('ddd, MMM D');
            var endWeekDisplay = moment(endWeek).format('ddd, MMM D');

            return { 
                startWeek: startWeek, 
                endWeek: endWeek, 
                startWeekDisplay: startWeekDisplay, 
                endWeekDisplay: endWeekDisplay 
            };
        }

        for(var i=1; i<=fullWeeks; i++){ //i=1 to skip the current week
            var d=substractDateFromIndex(i);
            $("#weekMenu").append("<li role='presentation'><a id='week"+ i +"' role='menuitem' href='#'>" + d.endWeekDisplay + " - " + d.startWeekDisplay + "</a></li>");
            $("#week" + i).click(function(e) {
                var weekId = e.target.id.replace(/[^0-9]+/, "");
                if(weekSelectedId !== weekId){
                    var d=substractDateFromIndex(parseInt(weekId));
                    weekSelectedId = weekId;
//                  var weekData = utils.filterByDates(history.fullData, d.endWeek, d.startWeek);
//              visualization.display(history, weekData);
                    $("#title h2").text("Browsing by hour of the day &amp; day of the week, " + d.endWeekDisplay + " - " + d.startWeekDisplay)
                }
            });
        }
    }

    visualization.display = function(selector, menu, sliderSelector, earliest) {
		$("#loading_modal").modal("show");

        var weeksList = weekMenu();
        var margin = { 
            top: 50, 
            right: 0, 
            bottom: 100, 
            left: 30 
        };

		visualization.earliest = earliest;

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


        $(selector).empty();

        var width = $(selector).width() - margin.left - margin.right;
        var height = $(selector).height() - margin.top - margin.bottom;
        
        var gridSize = Math.floor(width / 24);
        
        var legendElementWidth = gridSize * 2;
        
        var buckets = 9;
        var colors = ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]; // alternatively colorbrewer.YlGnBu[9]
        var days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
        var times = ["1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p", "12a"];

        var now = new Date();

        var endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        
        var end = endDate.getTime() + dayLength;
        var start = end - (7 * dayLength)
                
//        var days = [];
        var currentIndex = start;
        
//        while (currentIndex < end) {
//        	days.push(moment(currentIndex).format("dd"));
//        	
//        	currentIndex += dayLength;
//        }

        var svg = d3.select(selector).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var dayLabels = svg.selectAll(".dayLabel")
            .data(days)
            .enter().append("text")
            .text(function (d) { 
                return d; 
            })
            .attr("x", 0)
            .attr("y", function (d, i) { 
                return i * gridSize; 
            })
            .style("text-anchor", "end")
            .attr("transform", "translate(-6," + gridSize / 1.5 + ")")
            .attr("class", function (d, i) { 
                return ((i >= 0 && i <= 4) ? "dayLabel mono axis axis-workweek" : "dayLabel mono axis"); 
            });

        var timeLabels = svg.selectAll(".timeLabel")
            .data(times)
            .enter().append("text")
            .text(function(d) { 
                return d; 
            })
            .attr("x", function(d, i) { 
                return i * gridSize; 
            })
            .attr("y", 0)
            .style("text-anchor", "middle")
            .attr("transform", "translate(" + gridSize / 2 + ", -6)")
            .attr("class", function(d, i) { 
                return ((i >= 7 && i <= 16) ? "timeLabel mono axis axis-worktime" : "timeLabel mono axis"); 
            });
        
        database.fetchRecords(visualization.start, visualization.end, function(records) {
            var dataset = [];
            
            var recordIndex = 0;
            
            for (var i = 1; i <= 7; i++) {
            	for (var j = 1; j <= 24; j++) {
					var date = moment();

					date.day(i % 7);
					date.hour(j - 1);
            	
                    var item = {
                      "day": i,
                      "hour": j,
                      "value": 0,
                      "formattedDate": date.format('dddd ha'),
                      "tableDate": date.format('MMM D, YYYY - h A')
                    };
                    
                    dataset.push(item);
            	}
            }
            
            for (var i = 0; i < records.length; i++) {
            	var date = moment(records[i].visitTime);
            	
            	var day = date.day();
            	
            	if (day == 0) {
            		day = 7;
            	}

            	var hour = date.hour() + 1;
            	
            	var found = false;
            	
            	for (var j = 0; j < dataset.length && found == false; j++) {
            		var dataItem = dataset[j];
            		
            		if (dataItem['day'] == day && dataItem['hour'] == hour) {
            			dataItem['value'] += 1;
            			
            			found = true;
            		}
            	}
            }

            var colorScale = d3.scale.quantile()
                .domain([0, buckets - 1, d3.max(dataset, function (d) { 
                    return d.value; 
                })])
                .range(colors);
                
            if (menu == null) {
				menu = [{
					title: 'View in Data Table',
					action: function(d) {
						var dv = getIdArr(d);
						requirejs(["app/data-table"], function(data_table) {
							data_table.display(history, dv, "");
							var day = getDay(d);
							$(".wh-tooltip").remove();
							$("#viz_title").text("All Visits on " + day + " at " + d.__data__.hour + ":00 (24 hr format)");
							$("#title h2").text(dv.length + " visits - To return to a visualization please use the Navigation above.");
							vizSelected = "data_table";
							document.body.scrollTop = document.documentElement.scrollTop = 0;
						});
					},
				}, {
					title: 'View in Web Visits',
					action: function(d){
						var data = getIdArr(d);
						requirejs(["app/websites-visited"], function(wv) {
							var day = getDay(d);
							$(".wh-tooltip").remove();
							$("#viz_title").text("All Visits on " + day + " at " + d.__data__.hour + ":00 (24 hr format)");
							$("#title h2").text(data.length + " visits - To return to a visualization please use the Navigation above.");
							vizSelected = "web_visit";
							wv.display(history, data, 1);
							document.body.scrollTop = document.documentElement.scrollTop = 0;
						});
					}
				}];
			}

            var cards = svg.selectAll(".hour")
                .data(dataset, function(d) {
                    return d.day+':'+d.hour;
                });

            cards.append("title");

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

            var cardNode = cards.enter().append("rect")
                .attr("x", function(d) { 
                    return (d.hour - 1) * gridSize; 
                })
                .attr("y", function(d) { 
                    return (d.day - 1) * gridSize; 
                })
                .attr("rx", 4)
                .attr("ry", 4)
                .attr("class", "hour bordered")
                .attr("width", gridSize)
                .attr("height", gridSize)
                .on("mouseover", function(d){
					if (menu.length > 0) {
						tooltip.text("Visits: " + d.value + " on " + d["formattedDate"] +" -- Right-click to see what these visits are.");
					} else {
						tooltip.text("Visits: " + d.value + " on " + d["formattedDate"] +".");
					}
					
                    tooltip.style("visibility", "visible");
                })
                .on("mousemove", function() {
                    return tooltip.style("top", (d3.event.pageY-10) + "px").style("left", (d3.event.pageX+10) + "px");
                })
                .on("mouseout", function(){
                    return tooltip.style("visibility", "hidden");
                })
                .style("fill", colors[0]);
                
                if (menu.length > 0) {
					cardNode.on("contextmenu", d3.contextMenu(menu, function(){
	                    tooltip.style("visibility", "hidden");
    	            }));
    	        }

            cards.transition().duration(2000)
                .style("fill", function(d) { 
                    return colorScale(d.value); 
                });

            cards.exit().remove();

            var legend = svg.selectAll(".legend")
                .data([0].concat(colorScale.quantiles()), function(d) { 
                    return d; 
                });

            legend.enter().append("g")
                .attr("class", "legend");

            legend.append("rect")
                .attr("x", function(d, i) { 
                    return legendElementWidth * i; 
                })
                .attr("y", height)
                .attr("width", legendElementWidth)
                .attr("height", gridSize / 2)
                .style("fill", function(d, i) { 
                    return colors[i]; 
                });

            legend.append("text")
                .attr("class", "mono")
                .text(function(d) { 
                    return "≥ " + Math.round(d); 
                })
                .attr("x", function(d, i) { 
                    return legendElementWidth * i; 
                })
                .attr("y", height + gridSize);

            legend.exit().remove();             

			$("#loading_modal").modal("hide");
        });
    };
    
    return visualization;
});