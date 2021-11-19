// All the golbal variables 
let files = ["data/Data.json", "data/CanadaProvince.topojson", "data/Ottawa.topojson"];
let promises = [];
let provinceData = null;
let OttawaRegionData = null;
let attributeData  = null;
let expressed = "median age"
let attributeDataArray = [];

//begin script when window loads
window.onload = function()
{

    files.forEach(function(url) {
        promises.push(d3.json(url))
    });
    

    Promise.all(promises).then(function(values) {
        values.forEach(element => {
            if (element.arcs != undefined && element.arcs.length == 91)
            {
                element = topojson.feature(element, element.objects["CanadaProvince"])
                provinceData = element;
            }
            else if (element.arcs != undefined && element.arcs.length == 402)
            {
                element = topojson.feature(element, element.objects["Ottawa_Neighbourhood_Study_(ONS)_-_Neighbourhood_Boundaries_Gen_2"])
                OttawaRegionData = element;
            }
            else 
            {
                attributeData = element;
            }
            console.log(element)
        });

        joinData(attributeData, OttawaRegionData.features);
        loadMap (provinceData, OttawaRegionData,attributeData,expressed);
        createDropdown(attributeData);
    });
};

// load map info from all data source
let loadMap = (provinceData, OttawaRegionData, attributeData,expressed) =>{

    //map frame dimensions
    let width = window.innerWidth * 0.55,
    height = 800;

    let colorScale = makeColorScale(attributeData,expressed);

    //create new svg container for the map
    let map = d3.select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

    //create Albers equal area conic projection centered on France
    let projection = d3.geoAlbers()
    .center([-77.2, 45.84])
    .rotate([43.3,30.2,21])
    // .parallels([10,15])
    .scale(110000)
    .translate([width / 2, height / 2]);

    let path = d3.geoPath()
    .projection(projection);

    let countries = map.append("path")
    .datum(provinceData)
    .attr("class", "provinces")
    .attr("d", path);

    let ottawa = map.selectAll(".regions")
    .data(OttawaRegionData.features)
    .enter()
    .append("path")
    .attr("class", function(d){
        return "regions " + d.properties.Name;
    })
    .attr("d", path)
    .style("fill", function(d){
        return colorScale(d.properties[expressed]);
    })
    .style("stroke", "black")
    .style("stroke-width", "0.5")
    .on("mouseover", highlight)
    .on("mouseout", dehighlight)
    .on("mousemove", moveLabel);
    

//place graticule lines every 0.5 degrees of longitude and latitude
    let graticule = d3.geoGraticule()
        .step([0.5, 0.5]); 

    //create graticule background
    let gratBackground = map.append("path")
    .datum(graticule.outline()) //bind graticule background
    .attr("class", "gratBackground") //assign class for styling
    .attr("d", path) //project graticule
    
    //create graticule lines
    let gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines

    setChart(attributeData, colorScale, expressed);


}

// join the spatial and non-spatial data
let joinData = (attributeData, spatialFeatures) => {
    let joinFields = ["population(k)","income(k)","crime/million people","housing(10k)","employment-index","median age"]
    spatialFeatures.forEach(featureObj => {
        let regionName = featureObj.properties.Name
        joinFields.forEach(field => {
            if (attributeData[regionName]!=undefined) featureObj.properties[field] = attributeData[regionName][field]
        });
    });

}

// make the color scale to be used from the map or bar charts
let makeColorScale = (data,expressed) => {
    let colorClasses = [
        "#005a32",
        "#238b45",
        "#41ab5d",
        "#74c476",
        "#a1d99b",
        "#c7e9c0",
        "#e5f5e0",
        "#f7fcf5",
        "#fee0d2",
        "#fcbba1",
        "#fc9272",
        "#fb6a4a",
        "#ef3b2c",
        "#cb181d",
        "#99000d"
    ];

    //create color scale generator
    let colorScale = d3.scaleThreshold()
        .range(colorClasses);

    let dataArray = [];

    for(let i in data) dataArray.push([i, data[i]]);
    

    //build array of all values of the expressed attribute
    let domainArray = [];
    for (let i=0; i<dataArray.length; i++){
        let val = parseFloat(dataArray[i][1][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    let clusters = ss.ckmeans(domainArray, 15);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
}

//find the color
let choropleth = (props, colorScale, expressed) => {
    //make sure attribute value is a number
    let val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

// re-set the charts information
let setChart = (attributeData, colorScale, expressed)=>
{
    //chart frame dimensions
    let chartWidth = window.innerWidth * 0.35,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth// - leftPadding - rightPadding,
        chartInnerHeight = chartHeight //- topBottomPadding * 2,
        translate = "translate(25,5)";
    
    let expressedValRange = []
    for(let i in attributeData) attributeDataArray.push([i, attributeData[i]]);
    attributeDataArray.forEach(element => {
        expressedValRange.push(parseFloat(element[1][expressed]))
    });
    expressedValRange.sort((a, b)=>{return a - b});
    //create a second svg element to hold the bar chart
    let chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth+30)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    let chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //create a scale to size bars proportionally to frame
    let yScale = d3.scaleLinear()
    .range([chartHeight-10, 0])
    .domain([100,0]);

    //set bars for each province    
    let bars = chart.selectAll(".bars")
        .data(attributeDataArray)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[1][expressed]-b[1][expressed]
        })
        .attr("class", function(d){
            return "bars "+ d[0];
        })
        .attr("width", chartWidth / attributeDataArray.length - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / attributeDataArray.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[1][expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[1][expressed]));
        })
        .style("fill", function(d){
            return choropleth(d[1], colorScale, expressed);
        }).style("stroke", "black")
        .style("stroke-width", "0.5")
        .attr("transform", "translate(25,0)")
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    //below Example 2.8...create a text element for the chart title
    let chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(`The ${expressed} in each region`);

    //create vertical axis generator
    let yAxis = d3.axisLeft()
    .scale(yScale);
    // .orient("left");

    //place axis
    let axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    // create frame for chart border
    let chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
};

//function to create a dropdown menu for attribute selection
let createDropdown = (attributeData) =>  {


    //add select element
    let dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, attributeDataArray)
        });

    //add initial option
    let titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    let attrOptions = dropdown.selectAll("attrOptions")
        .data(Object.keys(attributeDataArray[1][1]))
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });

    //dropdown change listener handler
    let changeAttribute = (attribute, attributeDataArray) => {
        //change the expressed attribute
        expressed = attribute;
        let expressedValRange = []
        attributeDataArray.forEach(element => {
            expressedValRange.push(parseFloat(element[1][expressed]))
        });
        expressedValRange.sort((a, b)=>{return a - b});

        let chartWidth = window.innerWidth * 0.35,
        chartHeight = 473,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth// - leftPadding - rightPadding,
        chartInnerHeight = chartHeight //- topBottomPadding * 2,
        translate = "translate(25,5)";
        //recreate the color scale
        let colorScale = makeColorScale(attributeData,expressed);

        //create a scale to size bars proportionally to frame
        let yScale = d3.scaleLinear()
        .range([chartHeight-10, 0])
        .domain([100,0]);

        //recolor enumeration units
        let regions = d3.selectAll(".regions")
            .style("fill", function(d){
                return choropleth(d.properties, colorScale, expressed)
            });

        //re-sort, resize, and recolor bars
        let bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return a[1][expressed] - b[1][expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .attr("x", function(d, i){
            return i * (chartWidth / attributeDataArray.length);
        })
        //resize bars
        .attr("height", function(d, i){
            return yScale(parseFloat(d[1][expressed]));
        })
        .attr("y", function(d, i){
            return chartHeight - yScale(parseFloat(d[1][expressed]));
        })
        //recolor bars
        .style("fill", function(d){
            return choropleth(d[1], colorScale, expressed);
        });

        let chartTitle = d3.select(".chartTitle")
        .text(`The ${expressed} in each region`);

    };

    changeAttribute("population(k)",attributeDataArray)
};

// highlight the mouse over polygon or bar
let highlight = (props) => {
    if (props.target != undefined)
    {
        let className = props.target.className.baseVal.split(" ")[1]
        var selected = d3.selectAll("." + className)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        setLabel(props)
    }
};

 //function to reset the element style to the original style on mouseout
 let dehighlight = (props) => {
    if (props.target != undefined)
    {
        let className = props.target.className.baseVal.split(" ")[1]
        var selected = d3.selectAll("." + className)
        .style("stroke", "black")
        .style("stroke-width", "0.5")
        d3.select(".infolabel")
        .remove();
    }
};

// Reset the label values 
let setLabel = (props) => {
    //label content
    let rName = props.target.className.baseVal.split(" ")[1]
    let labelVar = ""
    attributeDataArray.forEach(element => {
        if (element[0] === rName) labelVar = element[1][expressed]
    });

    if (labelVar == "") labelVar = "No data avaliable for the region"
    let labelAttribute = `<h3>${rName} ${expressed}: </h3><b>${labelVar} </b>`;

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.adm1_code + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

// when mouse move, move the label
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.x + 10,
        y1 = event.y - 75,
        x2 = event.x - labelWidth - 10,
        y2 = event.y + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.x > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.y < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};