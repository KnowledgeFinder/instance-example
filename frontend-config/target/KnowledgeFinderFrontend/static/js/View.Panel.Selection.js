var SelectionPanel = function (elementSelector, infoFilters) {
    var self = this;
    self.event = d3.dispatch("removeFacetFilter", "removeFreeTextFilter");
    self.data = {
        url: null,
        infoFilters: infoFilters
    };
    if (!elementSelector)
        elementSelector = "body";
    self.element = d3.select(elementSelector);
    return d3.rebind(self, self.event, "on");
};

SelectionPanel.prototype.draw = function () {
    var self = this;
    var selectedFilterValues = utils.getSelectedFilterValues(utils.getSelectedQueries(self.data.url), self.data.infoFilters);

    // facet filter selections
    var facetButtons = self.element.selectAll(".facet-selection")
        .data(selectedFilterValues[0], function (d) {
            return d.query;
        });
    var newFacetButtons = facetButtons.enter()
        .append("div")
        .attr("class", function (d) {
            return self.data.infoFilters[d.id].cssClass + " facet-selection selection btn btn-default";
        })
        .on("click", function (x) {
            self.event.removeFacetFilter(x.id);
        });
    newFacetButtons.append("span").attr("class", "name").text(function (x) {
        return x.name;
    });
    newFacetButtons.append("span").attr("class", "glyphicon glyphicon-remove");
    facetButtons.exit().remove();

    // free text filter selections
    var freeTextButtons = self.element.selectAll(".text-selection")
        .data(selectedFilterValues[1], function (d) {
            return d;
        });
    var newFreeTextButtons = freeTextButtons.enter()
        .append("div")
        .attr("class", "text-selection selection btn btn-default")
        .on("click", function (x) {
            self.event.removeFreeTextFilter(x);
        });
    newFreeTextButtons.append("span").attr("class", "name").text(function (x) {
        return x;
    });
    newFreeTextButtons.append("span").attr("class", "glyphicon glyphicon-remove");
    freeTextButtons.exit().remove();

    return self;
};