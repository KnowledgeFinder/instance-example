var DateRangeFilterPanel = function (elementSelector, config) {
    var self = this;
    self.event = d3.dispatch("change");
    self.data = {
        initialValues: null,
        urlMinValue: null,
        urlMaxValue: null,
        field: config.field,
        title: config.title,
        dateFormat: config.format
    };

    self.timeScale = null;
    self.brush = null;
    self.formatDate = null;
    self.isoFormat = d3.time.format.utc("%Y-%m-%dT%H:%M:%S.%LZ");

    if (!elementSelector)
        elementSelector = "body";
    self.element = d3.select(elementSelector);

    self._init();

    return d3.rebind(self, self.event, "on");
};

DateRangeFilterPanel.prototype.draw = function () {
    var self = this;
    queue().defer(d3.json, self.data.urlMinValue)
        .defer(d3.json, self.data.urlMaxValue)
        .await(
            function (error, jsonMin, jsonMax) {
                var startDate = new Date(jsonMin.docs[0][self.data.field]);
                var endDate = new Date(jsonMax.docs[0][self.data.field]);

                if(!self.timeScale || self.timeScale.domain()[0].getTime() !== startDate.getTime() || self.timeScale.domain()[1].getTime() !== endDate.getTime()){
                    console.log(startDate, endDate);
                    self.timeScale = d3.time.scale()
                        .domain([startDate, endDate]);
                    self.brush = d3.svg.brush()
                        .x(self.timeScale);

                    console.log(self.data.initialValues);
                    if(self.data.initialValues)
                        self.brush.extent([self.isoFormat.parse(self.data.initialValues[0]), self.isoFormat.parse(self.data.initialValues[1])]);
                    else
                        self.brush.extent([startDate, endDate]);

                    //todo calculate the width
                    self._draw(300);
                }
            });
    return self;
};

DateRangeFilterPanel.prototype._init = function () {
    var self = this;
    var formatString = "";
    if(self.data.dateFormat.day){
        formatString += "%e";
    }
    if(self.data.dateFormat.month){
        if(formatString !== "")
            formatString += " ";
        formatString += "%b";
    }
    if(self.data.dateFormat.year) {
        if(formatString !== "")
            formatString += " ";
        formatString += "%Y";
    }

    if(self.data.dateFormat.utc)
        self.formatDate = d3.time.format.utc(formatString);
    else
        self.formatDate = d3.time.format(formatString);


    self.element.append("div")
        .attr("class", "panel-heading")
        .append("div")
        .attr("class", "panel-title")
        .text(self.data.title);
};

DateRangeFilterPanel.prototype._draw = function(width){
    var self = this;

    var height = 10;
    var marginLeft = height * 2;
    var marginTop = height * 3;

    self.timeScale
        .range([0, width - (2 * marginLeft)])
        .clamp(true);

    self.element.select("svg").remove();

    var svg = self.element.append("svg")
        .attr("viewBox", "0 0 " + width + " " + (height * 5))
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "panel-body")
        .append("g")
        .attr("transform", "translate(" + marginLeft + ",0)");
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + marginTop + ")")
        .call(d3.svg.axis()
            .scale(self.timeScale)
            .orient("bottom")
            .tickSize(0)
            .tickValues([]))
        .select(".domain")
        .attr("style", "stroke-width: " + height + "px;")
        .select(function () {
            return this.parentNode.appendChild(this.cloneNode(true));
        })
        .attr("class", "halo")
        .attr("style", "stroke-width: " + (height - 2) + "px;");

    var slider = svg.append("g")
        .attr("class", "slider")
        .call(self.brush);
    slider.selectAll(".extent")
        .remove();
    slider.select(".background")
        .attr("height", height)
        .attr("y", marginTop - 5);

    var handler = slider.selectAll(".resize");
    handler.append("circle")
        .attr("class", "handle")
        .attr("transform", "translate(0," + marginTop + ")")
        .attr("r", height - 1);
    handler.append('text')
        .text(function (d) {
            return self._getCurrentHandlerValue(d);
        })
        .attr("text-anchor", "middle")
        .attr("transform", "translate(0," + (height + 5) + ")");

    self.brush
        .on("brush", function(){
            handler.selectAll("text")
                .text(function (d) {
                    return self._getCurrentHandlerValue(d);
                });
        })
        .on("brushend", function() {
            var value = self.brush.extent();
            if (value[0].getTime() === value[1].getTime()) {
                value[1].setDate(value[1].getDate() + 1);
                slider.call(self.brush.extent([value[0], value[1]]));
                value = self.brush.extent();
            }

            var start = value[0], end = value[1];
            start = self.formatDate.parse(self.formatDate(start));
            end = self.formatDate.parse(self.formatDate(end));

            if(!self.data.dateFormat.month && !self.data.dateFormat.day && self.data.dateFormat.year)
                end = d3.time.year.offset(end, 1);

            if(!self.data.dateFormat.day&&self.data.dateFormat.month)
                end = d3.time.month.offset(end, 1);

            if(self.data.dateFormat.day)
                end = d3.time.day.offset(end, 1);

            self.event.change(self.data.field, self.isoFormat(start), self.isoFormat(end));
        });

    var value = self.brush.extent();
    slider.call(self.brush.extent([value[0], value[1]]));
};

DateRangeFilterPanel.prototype._getCurrentHandlerValue = function(d){
    var self = this;
    var value = self.brush.extent();
    if (d === "w")
        return self.formatDate(value[0]);
    else {
        return self.formatDate(value[1]);
    }
};
