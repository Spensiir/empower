var rowConverter = d => {   
    return {
        //year: format(d.year),
        year: +d.year,
        state: d.State,
        pm25: parseFloat(d.pm25),
        operational: +d.operational,
        scrubbers: +d.scrubbers,
        non_scrubbers: +d.non_scrubbers,
        inactive: +d.inactive
    }
}

Promise.all([
    d3.json("us_counties_2.json"),
    d3.csv("state_contributions_to_fulton.csv"),
    d3.json("us_states_2.json"),
    d3.csv("InactiveNonScrubberCombined.csv", rowConverter),
    d3.csv("stateNames.csv")
]).then((function(files) {
    var us_counties = files[0];
    var fulton = files[1];
    var us_states = files[2];
    var combined = files[3];
    stateNames = files[4];

    // var conus = topojson.feature(us_states, {
    //     type: "GeometryCollection",
    //     geometries: us_states.objects.us_states.geometries.filter(function(d) {
    //     //   return parseInt(d.properties.STATE) !== 2 // AK
    //     //     && parseInt(d.properties.STATE) !== 15 // HI
    //         return parseInt(d.properties.STATE) < 60; // outlying areas
    //     })
    //   });

    var states1 = topojson.feature(us_states, us_states.objects.us_states).features;

    var counties = topojson.feature(us_counties, us_counties.objects.us_counties),
        county = counties.features.filter(d => {
            return d.properties.NAME == "Fulton" && d.properties.STATE == "13";
        })

    var barHeader = d3.select("body")
        .append("h1")
        .classed("barHeader", "true")
        .text("GA")
        .attr("position", "absolute");

    var width = 700,
        height = 400;
    
    var svg = d3.select("body")
        .append("svg")
        .attr('id', 'body')
        .attr("width", width)
        .attr("height", height);

    var projection = d3.geoAlbersUsa().scale(750).translate([350, 170]);

    var path = d3.geoPath()
        .projection(projection);

    
    arcScale = d3.scaleLinear()
        .domain([0, d3.max(fulton, d => {
            return d.pm25;
        })])
        .range([0, 15]);
    
    arcColorScale = d3.scaleLinear()
        .domain([d3.min(fulton, d => {
            return d.pm25;
        }), d3.max(fulton, d => {
            return d.pm25;
        })])
        .range(["dark red", "red"])

    states = svg.selectAll("path")
        .data(states1)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("stroke", "black")
        .attr("fill", "white")
        .on('click', function (d) {
            updateState(stateConverter.get(d.properties.NAME));
            const state = d3.select(this);
            d3.select(".selectedState")
                .attr("stroke-width", 1)
                .classed("selectedState", false);
            state.classed("selectedState", true);
            state.attr("stroke-width", 3)
            ;
        });

    var slider = d3
        .sliderHorizontal()
        .min(1999)
        .max(2018)
        .step(1)
        .width(width)
        .displayValue(false)
        .tickFormat(d3.format("d"))
        .tickValues(d3.range(1999, 2019))
        .on('onchange', (val) => {
          updateMap(val);
        });
    
    d3.select('#slider')
        .append('svg')
        .attr('width', width + 100)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);

    

    var arcs = svg.append("g")
		.attr("class","arcs");

    function updateMap(year) {
        data = fulton.filter(d => {
            return d.year == year;
        })

        arcData = [];

        data.forEach(function(arc) {
            arcData.push({
                sourceLocation: [arc.stateLong, arc.stateLat],
                targetLocation: [arc.fultonLong, arc.fultonLat],
                pm25: +arc.pm25,
                state: arc.State,
            })
        })

        var theArcs = d3.select('.arcs').selectAll("path")
            .data(arcData, function(d) {
                return d.state;
            });
            
        theArcs.exit().remove()

        var theArcsEnter = theArcs.enter()
            .append("path")
            .attr('d', d => {
                return lngLatToArc(d, 'sourceLocation', 'targetLocation', 3)
            })
            .attr("stroke", "black")
            // .attr("stroke", d => {
            //     return arcColorScale(d.pm25)
            // })
            .attr("stroke-width", d => {
                return arcScale(d.pm25);
            })
            .attr("fill", "none")
            
        theArcsEnter.merge(theArcs)
            .attr('d', d => {
                return lngLatToArc(d, 'sourceLocation', 'targetLocation', 3)
            })
            .attr("stroke", "black")
            // .attr("stroke", d => {
            //     return arcColorScale(d.pm25)
            // })
            .attr("stroke-width", d => {
                return arcScale(d.pm25);
            })
            .attr("fill", "none")  
            
            
        //create map of year to pm25
        result = new Map(arcData.map(obj => [obj.state, obj.pm25]));

        stateConverter = new Map(stateNames.map(obj => [obj.State, obj.Code]));

        mapColorScale = d3.scaleLinear()
            .domain([d3.min(fulton, d => {
                return d.pm25;
            }), d3.max(fulton, d => {
                return d.pm25;
            })])
            .range(["#F2DF91", "#D8382E", "#701547"])

        //chloropleth on map
            states.attr("fill", d => {
                //console.log(result.get(stateConverter.get(d.properties.NAME)));
                return (result.get(stateConverter.get(d.properties.NAME))) ? mapColorScale(result.get(stateConverter.get(d.properties.NAME))) : "white"
            })
        }
            //function to draw the arc
    function lngLatToArc(d, sourceName, targetName, bend){
		// If no bend is supplied, then do the plain square root
		bend = bend || 1;
		// `d[sourceName]` and `d[targetname]` are arrays of `[lng, lat]`
		// Note, people often put these in lat then lng, but mathematically we want x then y which is `lng,lat`

		var sourceLngLat = d[sourceName],
				targetLngLat = d[targetName];

		if (targetLngLat && sourceLngLat) {
			var sourceXY = projection( sourceLngLat ),
					targetXY = projection( targetLngLat );

			// Uncomment this for testing, useful to see if you have any null lng/lat values
			// if (!targetXY) console.log(d, targetLngLat, targetXY)
			var sourceX = sourceXY[0],
					sourceY = sourceXY[1];

			var targetX = targetXY[0],
					targetY = targetXY[1];

			var dx = targetX - sourceX,
					dy = targetY - sourceY,
					dr = Math.sqrt(dx * dx + dy * dy)*bend;

			// To avoid a whirlpool effect, make the bend direction consistent regardless of whether the source is east or west of the target
			var west_of_source = (targetX - sourceX) < 0;
			if (west_of_source) return "M" + targetX + "," + targetY + "A" + dr + "," + dr + " 0 0,1 " + sourceX + "," + sourceY;
			return "M" + sourceX + "," + sourceY + "A" + dr + "," + dr + " 0 0,1 " + targetX + "," + targetY;
			
		} else {
			return "M0,0,l0,0z";
		}
    }

    //bar chart stuffs

    distinctStates = [...new Set(combined.map(d => d.state))];

    // onStateChange = async function() {
    //     const selection = d3.select("#stateSelection").node();
    //     const currentState = selection.options[selection.selectedIndex].value;

    //     //d3.select(".selected").classed("selected", false)
    //     updateState(currentState);
    // }

    
    // stateSelect = d3.select("body").append("select")
    //     .attr("id", "stateSelection")
    //     .attr("onchange", "onStateChange()");

    // stateSelect.selectAll("option")
    //     .data(distinctStates)
    //     .enter()
    //     .append("option")
    //     .attr("id", "stateSelection")
    //     .attr("value", d => d)
    //     .text(d => d)




    //static
    var margin = {top: 0, right: 20, bottom: 20, left: 40},
        padding = {top: 20, right: 20, bottom: 20, left: 20}
        chartWidth = 800,
        chartHeight = 200;


    //make group element for bar chart things
    var chartSvg2 = d3.select("body")
        .append("svg")
        .attr("height", chartHeight)
        .attr("width", chartWidth)
        .attr("transform", "translate(" + [0, -200] +")");   


    var chartSvg = d3.select("body")
        .append("svg")
        .attr("height", chartHeight)
        .attr("width", chartWidth)
        .attr("transform", "translate(" + [700, -200] +")"); 

    //line chart group
    var chartL = chartSvg2.append("g")    
        .attr("class", "chartL")
        .attr("width", (chartWidth - (margin.right + margin.right)))
        .attr("height", (chartHeight - (margin.bottom + margin.top)))
        .attr("transform", "translate(" + [margin.left, margin.top] +")"); 


    var chartS = chartSvg.append("g")
        .attr("class", "chartS")
        .attr("width", (chartWidth - (margin.right + margin.right)))
        .attr("height", (chartHeight - (margin.bottom + margin.top)))
        .attr("transform", "translate(" + [margin.left, margin.top] +")");





    var xScale = d3.scaleBand()
        .range([0, chartWidth - (margin.left + padding.left + margin.right + padding.right)])
        .paddingInner(0.1)

    var yScale = d3.scaleLinear()
        .range([chartHeight - (margin.top + padding.top), 0]);

    var colorScale = d3.scaleOrdinal()
        .domain(["inactive", "non_scrubbers", "scrubbers"])
        .range(["grey", "#267DB3", "#68C182"]);

    //create pm25 scale
    var pmScale = d3.scaleLinear()
        .range([chartHeight - (margin.top + padding.top), 0]);

    //axis groups
    var pmAxisL = chartL.append("g");

    var xAxisL = chartS.append("g")
        .attr("transform", "translate(" + [0, (chartHeight - margin.top - margin.bottom)] + ")");

    //y axis grid lines
    var pmAxisGridL = chartL.append("g")
        .attr("class", "grid");
    
    function make_pm_gridlines() {		
        return d3.axisLeft(pmScale)
            .ticks(5)
    }
    
    var yAxisS = chartS.append("g");





    //onStateChange
    function updateState(state) {
            //filter dataset by state
        chartData = combined.filter(d => {
            return d.state == state
        })

        series = d3.stack()
            .keys(["scrubbers", "non_scrubbers", "inactive"])
            (chartData);

        yScale.domain([0, d3.max(series, d => d3.max(d, d => d[1]))])

        xScale.domain(chartData.map(d => d.year))

        pmScale.domain([0, d3.max(chartData, d => {
            return d.pm25;
        })])

        //create line chart axis

        pmAxisL.transition().duration(500).call(d3.axisLeft(pmScale));

        xAxisL.transition().duration(500).call(d3.axisBottom(xScale));

        //grid lines

        pmAxisGridL.transition().duration(500).call(make_pm_gridlines()
            .tickSize(-chartWidth)
            .tickFormat(""));

        //create stacked bar graph axis

        yAxisS.transition().duration(500).call(d3.axisLeft(yScale));

        chartL.selectAll(".redPath")
            .remove()

        //draw line
        chartL.append("path")
            .datum(chartData)
            .attr("class", "redPath")
            .attr("fill", "none")
            .attr("stroke", "red")
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(d => {return xScale(d.year) + padding.left})
                .y(d => {return pmScale(d.pm25)}));

        chartS.selectAll(".series")
            .data(series)
            .join("g")
            .classed("series", true)
            .attr("fill", d => {
                console.log(colorScale(d.key));
                return colorScale(d.key)
            })
            .selectAll("rect")
            .data(d => (d))
            .join("rect")
                .attr("x", d => {
                    return xScale(d.data.year);
                })
                .attr("y", d => {
                    return yScale(d[1])
                })
                .attr("height", d => {
                    return (yScale(d[0]) - yScale(d[1]));
                })
                .attr("width", xScale.bandwidth());
        
        barHeader.text(state)

    }




    //legend
    legendArray = [
        {
            label: "scrubber",
            color: "#68C182"
        },
        {
            label:"operational",
            color: "#267DB3"
        },
        {
            label:"inactive",
            color:"grey"
        },
        {
            label:"pm2.5 contribution",
            color:"red"
        }
    ]

    var legend = chartSvg2.append("g")
        .classed("legend", true)
        .selectAll(".entries")
        .data(legendArray)
        .join("g");

    legend.append("rect")
        .attr("height", 15)
        .attr("width", 15)
        .attr("x", 600)
        .attr("y", (d, i) => 20 * i + 40)
        .attr("fill", d => d.color)
    legend.append("text")
        .attr("x", 620)
        .attr("y", (d, i) => 50 + (20 * i))
        .text(d => d.label)
        // .selectAll("p")
        // .text(d.label)

    //default map
    updateMap(1999)
    updateState("GA")

})).catch(function(err) {
    console.log(err);
})





    


