var DetailView = function (elementId, configData) {
    var self = this;
    self.event = d3.dispatch("close");
    self.data = {
        url: null,
        jsonData: null,
        config: configData
    };
    self.element = document.getElementById(elementId);

    $(self.element).on('hidden.bs.modal', self.event.close);
    self._init();

    return d3.rebind(self, self.event, "on");
};

DetailView.prototype.open = function () {
    var self = this;

    self.data.jsonData = {};
    d3.json(self.data.url, function (error, json) {
        if (error) {
            console.error(error);
            throw error;
        }
        if (json.docs.length > 0) {
            self.data.jsonData = json.docs[0];
            self._draw();
            $(self.element).modal("show");
        }
    });
    return self;
};

DetailView.prototype._init = function () {
    var self = this;
    var container = d3.select(self.element).select("#modalBody");
    for (var groupIndex = 0; groupIndex < self.data.config.body.length; groupIndex++) {
        if (groupIndex)
            container.append("hr");

        var entries = container.selectAll(".modal-content-entry")
            .data(self.data.config.body[groupIndex], function (d) {
                return d.field;
            });

        var resultEntry = entries.enter()
            .append("p")
            .attr("class", "modal-content-entry");
        resultEntry.append("strong")
            .attr("title", function (d) {
                return d.tooltip;
            })
            .text(function (d) {
                return d.title;
            });
        resultEntry.append("span");
    }
};

DetailView.prototype._draw = function () {
    var self = this;
    console.log(self.data.jsonData);

    // replace detail view title
    self.element.querySelector("#modalTitle").innerHTML = self.data.jsonData[self.data.config.title.field];

    var container = d3.select(self.element).select("#modalBody");

    var entries = container.selectAll(".modal-content-entry")
        .classed("hide", false);
    entries
        .select("span" )
        .html(function (d) {
            if (self.data.jsonData[d.field]){
            	if(d.type === "date")
            		return ": " + new Date(self.data.jsonData[d.field]).toDateString();
            	if(d.type === "link"){
            		var getLink = function(link){
            			if(link.indexOf("http") !== 0 && link.indexOf("www") !== 0)
            				return link;
           	   			return "<a href='" + link + "' target='_blank'>" + link + "</a>";
           			};
           			var links = self.data.jsonData[d.field];
           			if(Array.isArray(links)){
           	   			for(var linkIndex = 0; linkIndex < links.length; linkIndex++)
           	   				links[linkIndex] = getLink(links[linkIndex]);
           	   			return ": " + links.join(", ");
           			}
            		return ": " + getLink(links);
            	}
            	if(d.type === "localFile") {
            		var link = self.data.jsonData[d.field];
            		var url = (link.indexOf("http") !== 0 && link.indexOf("www") !== 0) ? "http://" + window.location.host + link : link;
       	   			return ": <a href='" + url + "' target='_blank'>download</a>";
            	}
            	if(Array.isArray(self.data.jsonData[d.field]))
            		return ": " + self.data.jsonData[d.field].join(", ");
            	return ": " + self.data.jsonData[d.field];
            }
            return ": -";
        });
    
    entries
        .filter(function (d) {
            return (d.hideIfNotSet && !self.data.jsonData[d.field]);
        })
        .classed("hide", true);

    // this works only as log as the document content (original source)
    // remains the only searchable field not displayed in the modal!
    if (!self.element.querySelector("em") && self.data.url.indexOf("query=&") === -1) {
        container.insert("p", ":first-child")
            .append("em")
            .text("Note: Your search term was found in the original source!");
    } else {
    	var firstChild = container.select("p");
    	if(!firstChild.classed("modal-content-entry"))
    		firstChild.remove();
    }
};