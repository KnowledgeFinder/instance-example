var ResultPanel = function (elementSelector, fieldDict, config, exportTypes) {
    var self = this;
    self.event = d3.dispatch("mouseover", "mouseout", "moreInfo", "goToPage", "sortBy", "download");
    self.data = {
        url: null,
        queryAllNodesUrl: null,
        json: null,
        fieldDict: fieldDict,
        collapsed: true,
        config: config,
        selectedEntries: []
    };
    if (!elementSelector)
        elementSelector = "body";
    self.element = d3.select(elementSelector);
    self.subElements = {
        collapse: {
            open: d3.select("#button-collapse-show"),
            close: d3.select("#button-collapse-hide")
        },
        exportOptions: d3.select("#export-options"),
        sortSelector: d3.select("#sortBy"),
        resultList: d3.select("#results"),
        resultEntries: null,
        selectInfo: d3.select("#select-info")
    };
    self._initSortSelector(config.sortOptions);
    self._initCollapseButtons();
    self._initExportOptions(exportTypes);

    d3.select("#button-deselect-all").on("click", function () {
        d3.event.preventDefault();
        self.data.selectedEntries = [];
        self._drawTable();
    });

    if (!exportTypes || exportTypes.length === 0){
        self.subElements.exportOptions.classed("hide", true);
        d3.select("#select").classed("hide", true);
        d3.select("#export-button").classed("hide", true);
    }
    return d3.rebind(self, self.event, "on");
};

//----------------------------------------------------------------------------------------------------------------------
//  draw
//----------------------------------------------------------------------------------------------------------------------
ResultPanel.prototype.draw = function () {
    var self = this;
    self._displayLoading(true);
    queue().defer(d3.json, self.data.url).await(
        function (error, jsonR) {
            self.data.json = jsonR;
            console.log(jsonR);
            self.data.json.docs.forEach(function (result) {
                var urlQuery = new QueryUrl(self.data.queryAllNodesUrl);
                urlQuery.setParameter(QueryUrl.params.filterQuery, "id:" + result.id);
                urlQuery.setParameter(QueryUrl.params.query, "");
                queue().defer(d3.json, urlQuery.data.url).await(
                    function (error, nodes) {
                        result.nodes = nodes;
                    });
            });
            self._drawSortSelector();
            self._drawPagination();
            self._drawTable();
            self._displayLoading(false);
        });

    return self;
};

ResultPanel.prototype._displayLoading = function (value) {
    var self = this;
    self.element.select(".load").classed("loaded", !value);
};

//----------------------------------------------------------------------------------------------------------------------
//  sort selector
//----------------------------------------------------------------------------------------------------------------------
ResultPanel.prototype._initSortSelector = function (sortOptions) {
    var self = this;

    self.subElements.sortSelector.selectAll("option").data(sortOptions)
        .enter()
        .append("option")
        .attr("value", function (d) {
            return d.value;
        })
        .text(function (d) {
            return d.text;
        });

    self.subElements.sortSelector.on("change", function () {
        d3.event.preventDefault();
        self.event.sortBy(this.value);
    });
};

ResultPanel.prototype._drawSortSelector = function () {
    var self = this;
    var queryUrl = new QueryUrl(self.data.url);
    var selectedValue = queryUrl.getParameter(QueryUrl.params.sort);

    self.subElements.sortSelector.selectAll("option").each( //TODO easier without d3???
        function () {
            if (this.value == selectedValue) {
                d3.select(this).attr("selected", "selected");
            } else {
                d3.select(this).attr("selected", null);
            }
        });
};

//----------------------------------------------------------------------------------------------------------------------
// export
//----------------------------------------------------------------------------------------------------------------------
ResultPanel.prototype._initExportOptions = function (exportTypes) {
    var self = this;
    var exportOption = self.subElements.exportOptions.selectAll("li").data(exportTypes)
        .enter()
        .append("li");
    exportOption.append("a")
        .attr("href", "#")
        .text(function (d) {
            return d + " (all)";
        })
        .on("click", function (d) {
            d3.event.preventDefault();
            self.event.download(d);
        });
    exportOption.append("a")
        .attr("href", "#")
        .text(function (d) {
            return d + " (selected)";
        })
        .on("click", function (d) {
            d3.event.preventDefault();
            self.event.download(d, self.data.selectedEntries);
        });

};

//----------------------------------------------------------------------------------------------------------------------
//  expand/collapse results buttons
//----------------------------------------------------------------------------------------------------------------------
ResultPanel.prototype._initCollapseButtons = function () {
    var self = this;
    self.setCollapsed(true);
    self.subElements.collapse.open.on("click", function () {
        self.setCollapsed(false);
    });
    self.subElements.collapse.close.on("click", function () {
        self.setCollapsed(true);
    });
};

ResultPanel.prototype.setCollapsed = function (value) {
    var self = this;

    self.subElements.resultList.selectAll(".panel-title a").classed("collapsed", value);
    self.subElements.resultList.selectAll(".collapse").classed("in", !value);
    self.data.collapsed = value;
    self.subElements.collapse.open.classed("hide", !value);
    self.subElements.collapse.close.classed("hide", value);
};

//----------------------------------------------------------------------------------------------------------------------
//  result list
//----------------------------------------------------------------------------------------------------------------------
ResultPanel.prototype._drawTable = function () {
    var self = this;

    // delete list and than redraw
    // d3 update pattern is not used, so the sorting order is not messed up
    if (self.subElements.resultEntries)
        self.subElements.resultEntries.remove();

    self.subElements.resultEntries = self.subElements.resultList.selectAll(".result").data(self.data.json.docs);

    var resultEntry = self.subElements.resultEntries.enter()
        .append("div")
        .attr("class", "result panel panel-default")
        .attr("id", function (d) {
            return "panel-" + d.id;
        })
        .on("mouseover", function (result) {
            self.event.mouseover(self._extractIds(result.nodes));
        })
        .on("mouseout", function (result) {
            self.event.mouseout(self._extractIds(result.nodes));
        });

    var resultHeading = resultEntry.append("div")
        .attr("class", "panel-heading");

    if (!self.subElements.exportOptions.classed("hide")){
        resultHeading.append("div")
            .attr("class", "checkbox")
            .append("input")
            .attr("type", "checkbox")
            .on("change", function (result) {
                if (d3.event.target.checked) {
                    self.data.selectedEntries.push(result.id);
                } else {
                    var index = self.data.selectedEntries.indexOf(result.id);
                    if (index > -1) {
                        self.data.selectedEntries.splice(index, 1);
                    }
                }
                self.subElements.selectInfo.text(self.data.selectedEntries.length);
            })
            .filter(function (result) {
                var index = self.data.selectedEntries.indexOf(result.id);
                return index > -1;
            })
            .attr("checked", true);

        self.subElements.selectInfo.text(self.data.selectedEntries.length);
    }

    var resultTitle = resultHeading.append("p")
        .attr("class", "panel-title");

    var resultTitleCollapse = resultTitle.append("a")
        .attr("class", "collapsed")
        .attr("data-toggle", "collapse")
        .attr("href", function (d) {
            return "#" + d.id;
        });
    resultTitleCollapse.append("span").attr("class", "glyphicon glyphicon-minus");
    resultTitleCollapse.append("span").attr("class", "glyphicon glyphicon-plus");
    resultTitle.append("span")
        .html(function (d) {
            return d.title;
        });

    var resultBody = resultEntry.append("div")
        .attr("id", function (d) {
            return "" + d.id;
        })
        .attr("class", "panel-body panel-collapse collapse");

    for (var groupIndex = 0; groupIndex < self.data.config.body.length; groupIndex++) {
        if (groupIndex)
            resultBody.append("hr");
        for (var entryIndex = 0; entryIndex < self.data.config.body[groupIndex].length; entryIndex++) {
            var entry = resultBody.append("div")
                .attr("class", self.data.config.body[groupIndex][entryIndex].class);
            entry.append("h4")
                .text(self.data.config.body[groupIndex][entryIndex].title);
            entry.append("p")
                .html(function (result) {
                    var maxTextLength = 300;
                    if (!result[self.data.config.body[groupIndex][entryIndex].field])
                        return "";
                    var content = result[self.data.config.body[groupIndex][entryIndex].field];
                    if (Array.isArray(content))
                        content = content.join(", ");
                    if (content.length > maxTextLength) {
                        content = content.substring(0, maxTextLength - 3);
                        content += "...";
                    }
                    return content;
                });
        }
    }

    resultBody.append("p")
        .append("a")
        .attr("href", function (result) {
            return "#" + result.id;
        })
        .text("More Information")
        .on("click", function (result) {
            d3.event.preventDefault();
            return self.event.moreInfo(result.id);
        });
};

ResultPanel.prototype._drawPagination = function () {
    var self = this;
    var urlquery = new QueryUrl(window.location.href);
    var itemsTotal = self.data.json.numFound;
    var currentStart = self.data.json.start;
    var itemsPage = self.data.json.rows;

    var numPages = Math.ceil(itemsTotal / itemsPage);
    var firstItemOfLastPage = ((numPages - 1) * itemsPage);

    var stats = d3.selectAll("#stats");
    var end = Math.min(currentStart + itemsPage, itemsTotal);
    var start = itemsTotal > 0 ? (currentStart + 1) : 0;
    stats.text("Showing " + start + "-" + end + " of " + itemsTotal + " entries.");

    var pagination = d3.selectAll(".pagination");
    var startPagination = Math.max(0, currentStart - (4 * itemsPage));
    var endPagination = Math.min(itemsTotal, currentStart + (5 * itemsPage));
    var pagesValues = d3.range(startPagination, endPagination, itemsPage);

    pagination.selectAll("li").remove();
    var pages = pagination.selectAll("li").data(pagesValues);

    if (currentStart > 0) {
        var previousPage = currentStart - itemsPage;
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, previousPage);
                return urlquery.data.url;
            })
            .on("click", function () {
                d3.event.preventDefault();
                self.event.goToPage(previousPage);
            })
            .text("←");
    }

    if (startPagination > 0) {
        var firstPage = 0;
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, firstPage);
                return urlquery.data.url;
            })
            .on("click", function () {
                console.log("here");
                d3.event.preventDefault();
                self.event.goToPage(firstPage);
            })
            .text("1");
    }

    if (startPagination > itemsPage) {
        var tenPagesPrevious = Math.max(currentStart - (itemsPage * 10), 0);
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, tenPagesPrevious);
                return urlquery.data.url;
            })
            .on("click", function () {
                d3.event.preventDefault();
                self.event.goToPage(tenPagesPrevious);
            })
            .text("...");
    }

    pages.enter().append("li")
        .classed("active", function (x) {
            return currentStart == x;
        })
        .append("a")
        .attr("href", function (d) {
            urlquery.setParameter(QueryUrl.params.start, d);
            return urlquery.data.url;
        })
        .on("click", function (x) {
            d3.event.preventDefault();
            self.event.goToPage(x);
        })
        .text(function (d) {
            return Math.floor(d / itemsPage) + 1;
        });

    if (endPagination <= firstItemOfLastPage - itemsPage) {
        var tenPagesNext = Math.min(currentStart + (itemsPage * 10), firstItemOfLastPage);
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, tenPagesNext);
                return urlquery.data.url;
            })
            .on("click", function () {
                d3.event.preventDefault();
                self.event.goToPage(tenPagesNext);
            })
            .text("...");
    }

    if (endPagination <= firstItemOfLastPage) {
        var lastPage = firstItemOfLastPage;
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, lastPage);
                return urlquery.data.url;
            })
            .on("click", function () {
                console.log("here");
                d3.event.preventDefault();
                self.event.goToPage(lastPage);
            })
            .text(numPages);
    }

    if (currentStart < firstItemOfLastPage) {
        var x2 = currentStart + itemsPage;
        pagination.append("li")
            .append("a")
            .attr("href", function () {
                urlquery.setParameter(QueryUrl.params.start, x2);
                return urlquery.data.url;
            })
            .on("click", function () {
                d3.event.preventDefault();
                self.event.goToPage(x2);
            })
            .text("→");
    }
};

ResultPanel.prototype.setHighlight = function (idFilter, value) { //value == true | false
    var self = this;
    self.subElements.resultEntries.filter(
        function (result) {
            if (!result.nodes)
                return false;
            var nodesId = self._extractIds(result.nodes);
            return nodesId.indexOf(idFilter) !== -1;
        })
        .classed("highlight", value);
};

ResultPanel.prototype._extractIds = function (nodes) {
    var self = this;
    var ids = [];
    for (var groupField in nodes) {
        if (nodes.hasOwnProperty(groupField)) {
            var subGroupNodes = nodes[groupField];
            subGroupNodes.forEach(function (n) {
                if (n.count > 0) {
                    var id = self.data.fieldDict[groupField] + "_" + n.id;
                    ids.push(id);
                }
            });
        }
    }
    return ids;
};