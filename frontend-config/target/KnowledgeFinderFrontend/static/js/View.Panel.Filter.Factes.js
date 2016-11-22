var FacetsFilterPanel = function (elementSelector, facetDict, fieldDict, config) {
    var self = this;
    self.event = d3.dispatch(
        "add",
        "remove",
        "displayFacetsFilter",
        "displayFacetFilter",
        "mouseover",
        "mouseout",
        "mouseoverFacetsFilter",
        "mouseoutFacetsFilter");
    self.data = {
        queryNodesUrl: null,
        url: null,
        json: null,
        facetDict: facetDict,
        fieldDict: fieldDict,
        config: config
    };

    if (!elementSelector)
        elementSelector = "body";
    self.element = d3.select(elementSelector);

    return d3.rebind(self, self.event, "on");
};

FacetsFilterPanel.prototype.draw = function () {
    var self = this;
    self._displayLoading(true);
    queue().defer(d3.json, self.data.queryNodesUrl).await(
        function (error, jsonR) {
            self.data.json = jsonR;
            console.log(jsonR);
            console.log(self.data.facetDict);
            console.log(self.data.fieldDict);

            self._processData();
            if (!document.getElementById("facets-filters").innerHTML)
                self._draw();
            self._updateTable();
            self._displayLoading(false);
        });
    return self;
};

FacetsFilterPanel.prototype._displayLoading = function (value) {
    var self = this;
    self.element.classed("loaded", !value);
};

FacetsFilterPanel.prototype.setHighlight = function (id, value) { //value == true | false
    var self = this;
    self.element.select("#filter-" + id).classed("highlight", value);
};

FacetsFilterPanel.prototype._processData = function () {
    var self = this;
    for (var group in self.data.json) {
        if (self.data.json.hasOwnProperty(group)) {
            var facetId = self.data.facetDict[self.data.fieldDict[group]].id;
            self.data.json[group].forEach(function (m) {
                m.id = facetId + "_" + m.id;
            });
        }
    }
};

FacetsFilterPanel.prototype._draw = function () {
    var self = this;
    console.log(self.data.config);

    if (self.data.config) {
        var facets = self.element.select("#facets-filters").selectAll(".facets-filter")
            .data(self.data.config, function (entry) {
                return entry.id;
            })
            .enter()
            .append("div")
            .attr("id", function (facetsGroup) {
                return "group-" + facetsGroup.id;
            })
            .attr("class", function (facetsGroup) {
                return "facets-filter panel panel-default " + facetsGroup.cssClass;
            });

        var facetsTitle = facets.append("div")
            .attr("class", "facets-header panel-heading")
            .on("mouseenter", function (d) {
                self.event.mouseoverFacetsFilter(d.id);
            })
            .on("mouseleave", function (d) {
                self.event.mouseoutFacetsFilter(d.id);
            })
            .append("p")
            .attr("class", "panel-title");

        self._drawCollapseIndicator(facetsTitle);

        facetsTitle.append("span")
            .attr("class", "name")
            .text(function (facetsGroup) {
                return facetsGroup.name;
            });

        var subGroup = self._drawFacetFilter(facets, 0);
        self._drawFacetFilter(subGroup, 1);
    }
};

FacetsFilterPanel.prototype._drawFacetFilter = function (parend, level) {
    var self = this;
    var facetList = parend.append("div")
        .attr("id", function (facetGroup) {
            return "table-" + facetGroup.id;
        })
        .attr("class", "panel-body panel-collapse collapse")
        .append("div")
        .attr("class", function (facetGroup) {
            return facetGroup.scrollable ? "scroll" : "notscroll";
        })
        .append("ul")
        .attr("class", "list-facet-level-" + level);

    var facet = facetList.selectAll(".facet-level-" + level)
        .data(function (facetGroup) {
            if (self.data.json[facetGroup.subItemsFacet])
                return self.data.json[facetGroup.subItemsFacet].filter(function (jsonEntry) {
                    return jsonEntry.id.indexOf("_ANY") === -1;
                });
            if (facetGroup.subItems)
                return facetGroup.subItems;
            return [];
        }, function (jsonEntry) {
            return jsonEntry.id;
        })
        .enter()
        .append("li")
        .attr("id", function (facetGroupItem) {
            var id = "filter-" + facetGroupItem.id;
            return (facetGroupItem.count || facetGroupItem.count === 0) ? id : id + "__ANY";
            //return "filter-" + facetGroupItem.id;
        })
        .attr("class", function (facetGroupItem) {
            var classes = "facet-level-" + level + " filter";
            if (facetGroupItem.cssClass)
                classes = classes + " " + facetGroupItem.cssClass;
            if (facetGroupItem.children_filter) // TODO + if actually has children
                classes = classes + " filtergroup";
            return classes;
        })
        .append("div")
        .attr("class", "facet-filter panel panel-default");

    self._drawFacetHeading(facet, level);

    return facet;
};

FacetsFilterPanel.prototype._drawFacetHeading = function (parend, level) {
    var self = this;
    var facetHeading = parend.append("div")
        .attr("class", "panel-heading facet-level-" + level + "-header filter-spans")
        .on("mouseenter", function (d) {
            self.event.mouseover(d.query ? d.id : d.id + "__ANY");
        })
        .on("mouseleave", function (d) {
            self.event.mouseout(d.query ? d.id : d.id + "__ANY");
        });

    self._drawCollapseIndicator(facetHeading.filter(function (facetGroupItem) {
        return facetGroupItem.subItemsFacet;
    }));

    facetHeading.append("a")
        .attr("class", "facet-label")
        .attr("href", function (facetGroupItem) {
            var link = "#filter-" + facetGroupItem.id;
            return facetGroupItem.children_filter ? link + "__ANY" : link;
            //return "#filter-" + facetGroupItem.id;
        })
        .on("click", function (d) {
            d3.event.preventDefault();
            if (self._getFilterDisabled(d) === false) {
                if (self._isFilterSelected(d) === false)
                    self.event.add(d.id);
                else
                    self.event.remove(d.id);
            }
        })
        .append("span")
        .attr("class", "name")
        .text(function (facetGroupItem) {
            return facetGroupItem.name;
        });

    var facetCount = facetHeading.append("div")
        .attr("class", "count-remove");
    facetCount.append("span")
        .attr("class", "glyphicon glyphicon-remove")
        .on("click", function (d) {
            d3.event.preventDefault();
            self.event.remove(d.id);
        });
    facetCount.append("span")
        .attr("class", "count badge");

};

FacetsFilterPanel.prototype._showFacetsFilter = function (self, grp, show) {
    var field = grp.subItemsFacet;
    if (field !== undefined && field !== null && field !== "") {
        self.event.displayFacetFilter(field, show);
    } else {
        field = [];
        d3.select("#group-" + grp.id)
            .selectAll(".facet-level-0")
            .each(function (filter) {
                field.push(self.data.facetDict[filter.id].field);
            });
        self.event.displayFacetsFilter(field, show);
    }
};

FacetsFilterPanel.prototype._drawCollapseIndicator = function (parent) {
    var self = this;
    var facetCollapseIndicator = parent.append("a")
        .attr("class", "toggle-collapse-facet-filter collapsed")
        .html(function (facetGroupItem) {
            return facetGroupItem.children_filter || facetGroupItem.subItems ? "" : "&nbsp;"
        })
        .on("click", function (grp) {
            d3.event.preventDefault();
            var show = false;
            if (grp.subItemsFacet) {
                show = !self._isFacetSubFilterDisplayed(self.data.facetDict[grp.id].field);
            } else {
                show = !self._isFacetsFilterDisplayed(grp);
            }
            self._showFacetsFilter(self, grp, show);
        })
        .filter(function (facetGroupItem) {
            return facetGroupItem.children_filter || facetGroupItem.subItems;
        });
    facetCollapseIndicator.append("span")
        .attr("class", "glyphicon glyphicon-plus");
    facetCollapseIndicator.append("span")
        .attr("class", "glyphicon glyphicon-minus");
};

FacetsFilterPanel.prototype._updateTable = function () {
    var self = this;

    // update data
    var facetsFilters = self.element.selectAll(".facets-filter");
    var data = [];
    for (var subItemsFacet in self.data.json)
        if (self.data.json.hasOwnProperty(subItemsFacet))
            data = data.concat(self.data.json[subItemsFacet]);
    var filters = facetsFilters.selectAll(".filter");
    filters.data(data, function (jsonEntry) {
        return jsonEntry.id;
    });

    // collapse or open facets depending on url
    facetsFilters.each(function (facetsFilter) {
        var show = self._isFacetsFilterDisplayed(facetsFilter);
        d3.select(this).select(".panel-body").classed("in", show);
        d3.select(this).select(".toggle-collapse-facet-filter").classed("collapsed", !show);
    });
    filters.each(function (facetFilters) {
        if (self.data.facetDict[facetFilters.id]) {
            var show = self._isFacetSubFilterDisplayed(self.data.facetDict[facetFilters.id].field);
            d3.select(this).select(".panel-body").classed("in", show);
            d3.select(this).select(".toggle-collapse-facet-filter").classed("collapsed", !show);
        }
    });

    // update document count and mark facets with a count of 0 as disabled
    filters.select(".count")
        .text(function (facetGroupItem) {
            if (facetGroupItem.subItemsFacet) {
                var facetGroupItemContent = self.data.json[facetGroupItem.subItemsFacet];
                facetGroupItem.count = facetGroupItemContent[facetGroupItemContent.length - 1].count;
            }
            return facetGroupItem.count;
        });
    filters.select(".facet-label").classed("disabled", function (filter) { //selection
        if (filter.subItemsFacet) {
            var facetGroupItemContent = self.data.json[filter.subItemsFacet];
            filter = facetGroupItemContent[facetGroupItemContent.length - 1];
        }
        return self._getFilterDisabled(filter);
    });

    // sort
    var facetsLevel0 = facetsFilters.selectAll(".facet-level-0");
    facetsLevel0.sort(function (a, b) {
        return self._sortFilter(a, b);
    });

    facetsLevel0.selectAll(".facet-level-1").sort(function (a, b) {
        return self._sortFilter(a, b);
    });

    // display x instead of count if facet is selected
    filters.classed("selected", function (filter) {
        if (filter.subItemsFacet) {
            var facetGroupItemContent = self.data.json[filter.subItemsFacet];
            filter = facetGroupItemContent[facetGroupItemContent.length - 1];
        }
        return self._isFilterSelected(filter);
    });
};

FacetsFilterPanel.prototype._sortFilter = function (filterA, filterB) {
    var self = this;
    var selA = self._isFilterSelected(filterA);
    var selB = self._isFilterSelected(filterB);

    if (selA === true && selB === true) return 0;
    if (selA === true) return -1;
    if (selB === true) return 1;
    return filterB.count - filterA.count;
};

FacetsFilterPanel.prototype._isFacetSubFilterDisplayed = function (field) {
    var self = this;
    var urlquery = new QueryUrl(self.data.url);
    return urlquery.parameterContainsValue(QueryUrl.params.groups, field, QueryUrl.delimiter.COMMA);
};

FacetsFilterPanel.prototype._isFacetsFilterDisplayed = function (facetsFilter) {
    var self = this;
    var urlquery = new QueryUrl(self.data.url);
    if (facetsFilter.subItems.length === 0)
        return self._isFacetSubFilterDisplayed(facetsFilter.subItemsFacet);
    for (var index = 0; index < facetsFilter.subItems.length; index++) {
        var field = self.data.facetDict[facetsFilter.subItems[index].id].field;
        if (urlquery.parameterContainsValue(QueryUrl.params.groupsAny, field, QueryUrl.delimiter.COMMA))
            return true;
    }
    return false;
};

FacetsFilterPanel.prototype._isFilterSelected = function (filter) {
    var self = this;
    var urlquery = new QueryUrl(self.data.url);
    return urlquery.parameterContainsValue(QueryUrl.params.filterQuery, filter.query, QueryUrl.delimiter.AND);
};

FacetsFilterPanel.prototype._getFilterDisabled = function (filter) {
    return filter.count <= 0;
};