var View = function () {
    var self = this;

    self.data = {
        query: {
            initialOptions: {
                sort: null,
                groups: [],
                groupsAny: [],
                initialPage: resultConfig.pages.initial,
                rowsPage: resultConfig.pages.rows,
                nodesLimit: filterConfig.graph.nodes.maxNumber,
                query: "",
                filterQuery: ""
            },
            getAllNodes: null
        },
        fields: {
            detailView: null,
            detailViewHighlight: null,
            resultListEntry: null,
            resultListEntryHighlight: null,
            export: {}
        },
        facetsDataList: allFacets,
        fieldsDict: allFields,
        url: null,
        hideGraph: filterConfig.graph.hide
    };

    self.subElements = {
        graphPanel: null,
        facetsFilterPanel: null,
        dateRangeFilterPanel: null,
        resultPanel: null,
        detailView: null,
        selectionPanel: null
    };

    self.event = d3.dispatch("load");
    self.event.on("load.general", function (url, reGraph) {
        self.update(url, reGraph);
    });

    d3.select("#freetextform").on("submit", function () { //TODO tidy up
        d3.event.preventDefault();
        var textVal = d3.select("#search-field");
        var value = textVal.property("value");
        if (value) {
            self._applyFreeTextFilter(value, true);
            textVal.property("value", "");
        }
        return false;
    });

    for (var field in self.data.fieldsDict) {
        if (self.data.fieldsDict.hasOwnProperty(field)) {
            var id = self.data.fieldsDict[field];
            self.data.facetsDataList[id + "__ANY"] = self.data.facetsDataList[id];
        }
    }

    // set initial query values
    for (var filterIndex = 0; filterIndex < filterConfig.facets.length; filterIndex++) {
        var filter = filterConfig.facets[filterIndex];
        if (!filter.collapsed) {
            if (filter.subItems.length > 0)
                for (var subFilterIndex = 0; subFilterIndex < filter.subItems.length; subFilterIndex++) {
                    self.data.query.initialOptions.groupsAny.push(filter.subItems[subFilterIndex].subItemsFacet);
                    if (!filter.subItems[subFilterIndex].collapsed)
                        self.data.query.initialOptions.groups.push(filter.subItems[subFilterIndex].subItemsFacet);
                }
            else
                self.data.query.initialOptions.groups.push(filter.subItemsFacet);
        }
    }
    self.data.query.initialOptions.groups = self.data.query.initialOptions.groups.join(",");
    self.data.query.initialOptions.groupsAny = self.data.query.initialOptions.groupsAny.join(",");

    for (var sortOptionIndex = 0; sortOptionIndex < resultConfig.sortOptions.length; sortOptionIndex++)
        if (resultConfig.sortOptions[sortOptionIndex].default === true)
            self.data.query.initialOptions.sort = resultConfig.sortOptions[sortOptionIndex].value;

    self.data.query.initialOptions.initialPage = resultConfig.pages.initial;
    self.data.query.initialOptions.rowsPage = resultConfig.pages.rows;
    self.data.query.initialOptions.nodesLimit = filterConfig.graph.nodes.maxNumber;

    // url to get all nodes
    var allGroupsName = Object.keys(self.data.fieldsDict).join(",");
    var allNodesQuery = new QueryUrl(baseUrl + "get-nodes")
        .setParameter(QueryUrl.params.groups, allGroupsName)
        .setParameter(QueryUrl.params.groupsAny, allGroupsName)
        .setParameter(QueryUrl.params.limit, "-1")
        .setParameter(QueryUrl.params.query, "")
        .setParameter(QueryUrl.params.filterQuery, "");
    self.data.query.getAllNodes = allNodesQuery.data.url;

    //set which fields needs to be queried to draw resultList/detailView
    var fieldNames = self.extractFieldNames(resultConfig);
    self.data.fields.resultListEntry = fieldNames[0];
    self.data.fields.resultListEntryHighlight = fieldNames[1];

    fieldNames = self.extractFieldNames(detailViewConfig);
    self.data.fields.detailView = fieldNames[0];
    self.data.fields.detailViewHighlight = fieldNames[1];

    for (var exportType in exportConfig)
        self.data.fields.export[exportType] = exportConfig[exportType].fields.join(",");

    var exportTypes = null;
    if(exportConfig)
        exportTypes = Object.keys(exportConfig);

    //init panels and views
    self._init(resultConfig, detailViewConfig, filterConfig.facets, filterConfig.dateRange, exportTypes);
};

//----------------------------------------------------------------------------------------------------------------------
//  init
//----------------------------------------------------------------------------------------------------------------------
View.prototype._init = function (resultListConfig, detailViewConfig, facetFilterConfig, dateRangeFilterConfig, exportTypes) {
    var self = this;

    self.subElements.graphPanel = new GraphPanel("#graph1", self.data.fieldsDict, self.data.facetsDataList);
    self.subElements.graphPanel.init();
    self.subElements.facetsFilterPanel = new FacetsFilterPanel("#selecttable", self.data.facetsDataList, self.data.fieldsDict, facetFilterConfig);
    if (dateRangeFilterConfig)
        self.subElements.dateRangeFilterPanel = new DateRangeFilterPanel("#range-filter", dateRangeFilterConfig);
    self.subElements.resultPanel = new ResultPanel("#resultPanel", self.data.fieldsDict, resultListConfig, exportTypes);
    self.subElements.detailView = new DetailView("knowledge-finder-2-modal", detailViewConfig);
    self.subElements.selectionPanel = new SelectionPanel("#current-selection", self.data.facetsDataList);

    self.subElements.detailView
        .on("close", function () {
            self._displayDetailView(null);
        });

    self.subElements.selectionPanel
        .on("removeFreeTextFilter", function (query) {
            self._applyFreeTextFilter(query, false);
        })
        .on("removeFacetFilter", function (id) {
            self._applyFacetFilters([id], false);
        });

    self.subElements.resultPanel
        .on("moreInfo", function (id) {
            self._displayDetailView(id);
        })
        .on("mouseover", function (ids) {
            self._highlightFacetFilters(ids, true);
        })
        .on("mouseout", function (ids) {
            self._highlightFacetFilters(ids, false);
        })
        .on("goToPage", function (startPage) {
            var queryUrl = new QueryUrl(self.data.url);
            queryUrl.setParameter(QueryUrl.params.start, startPage);
            self.event.load(queryUrl.data.url);
        })
        .on("sortBy", function (value) {
            if (value) {
                var queryUrl = new QueryUrl(self.data.url);
                queryUrl.setParameter(QueryUrl.params.sort, value);
                self.event.load(queryUrl.data.url);
            }
        })
        .on("download", function (exportType, ids) {
            var currentQueryUrl = new QueryUrl(self.data.url);
            var currentQuery = currentQueryUrl.getParameter(QueryUrl.params.query);

            var queryUrl = new QueryUrl(baseUrl + "export-documents/")
                .setParameter(QueryUrl.params.query, currentQuery)
                .setParameter(QueryUrl.params.fields, self.data.fields.export[exportType])
                .setParameter(QueryUrl.params.exportType, exportType.toLowerCase());

            if (!ids) {
                ids = [];
                var currentFilterQuery = currentQueryUrl.getParameter(QueryUrl.params.filterQuery);
                queryUrl.setParameter(QueryUrl.params.filterQuery, currentFilterQuery);
            }
            for (var idIndex = 0; idIndex < ids.length; idIndex++) {
                queryUrl.appendValueToParameter(QueryUrl.params.filterQuery, "id:" + ids[idIndex], QueryUrl.delimiter.queryOrSplit);
            }

            d3.json(queryUrl.data.url, function (error, json) {
                if (error) {
                    console.error(error);
                    throw error;
                }
                if (json.docs.length > 0) {
                    window.open("data:text/plain," + encodeURIComponent(json.exportString), "_blank");
                }
            });
        });

    self.subElements.facetsFilterPanel
        .on("remove", function (id) {
            self._applyFacetFilters([id], false);
        })
        .on("add", function (id) {
            self._applyFacetFilters([id], true);
        })
        .on("mouseover", function (id) {
            self._highlightFacetFilter(id, true);
        })
        .on("mouseout", function (id) {
            self._highlightFacetFilter(id, false);
        })
        .on("mouseoverFacetsFilter", function (facetsFilterId) {
            self._highlightFacetsFilter(facetsFilterId, true);
        })
        .on("mouseoutFacetsFilter", function (facetsFilterId) {
            self._highlightFacetsFilter(facetsFilterId, false);
        })
        .on("displayFacetsFilter", function (facetsFilter, value) {
            self._displayFacetsFilter(facetsFilter, value);
        })
        .on("displayFacetFilter", function (facetFilter, value) {
            self._displayFacetFilter(facetFilter, value);
        });

    self.subElements.graphPanel
        .on("add", function (listId) {
            self._applyFacetFilters(listId, true);
        })
        .on("mouseoverNode", function (id) {
            self._highlightFacetFilter(id, true);
        })
        .on("mouseoutNode", function (id) {
            self._highlightFacetFilter(id, false);
        })
        .on("mouseoverEdge", function (edge) {
            self._highlightEdge(edge, true);
        })
        .on("mouseoutEdge", function (edge) {
            self._highlightEdge(edge, false);
        });

    if (self.data.hideGraph) {
        document.getElementById("graph-panel").querySelector("[data-parent='#graph-panel']").classList.add("collapsed");
        document.getElementById("graph1").classList.remove("in");
    }

    if (self.subElements.dateRangeFilterPanel) {
        self.subElements.dateRangeFilterPanel
            .on("change", function (field, start, end) {
                self._applyDateRangeFilter(field, start, end);
            });
    }
};

View.prototype.extractFieldNames = function (config) {
    var highlightFiled = [], standardField = [];
    for (var property in config) {
        if (!Array.isArray(config[property])) {
            if (config[property].highlight)
                highlightFiled.push(config[property].field);
            standardField.push(config[property].field);
        } else {
            for (var groupIndex = 0; groupIndex < config.body.length; groupIndex++) {
                for (var fieldIndex = 0; fieldIndex < config.body[groupIndex].length; fieldIndex++) {
                    if (config.body[groupIndex][fieldIndex].highlight)
                        highlightFiled.push(config.body[groupIndex][fieldIndex].field);
                    standardField.push(config.body[groupIndex][fieldIndex].field);
                }
            }
        }
    }
    return [standardField.join(","), highlightFiled.join(",")];
};

View.prototype.draw = function () {
    var self = this;
    // initial query
    var queryUrl = new QueryUrl(window.location.href);
    if (queryUrl.getParameter(QueryUrl.params.query) === undefined)
        queryUrl.setParameter(QueryUrl.params.query, self.data.query.initialOptions.query);
    if (queryUrl.getParameter(QueryUrl.params.filterQuery) === undefined)
        queryUrl.setParameter(QueryUrl.params.filterQuery, self.data.query.initialOptions.filterQuery);

    // initial values facets/show/hide
    if (queryUrl.getParameter(QueryUrl.params.groups) === undefined)
        queryUrl.setParameter(QueryUrl.params.groups, self.data.query.initialOptions.groups);
    if (queryUrl.getParameter(QueryUrl.params.groupsAny) === undefined)
        queryUrl.setParameter(QueryUrl.params.groupsAny, self.data.query.initialOptions.groupsAny);

    // pagination
    if (queryUrl.getParameter(QueryUrl.params.start) === undefined)
        queryUrl.setParameter(QueryUrl.params.start, self.data.query.initialOptions.initialPage);
    if (queryUrl.getParameter(QueryUrl.params.rows) === undefined)
        queryUrl.setParameter(QueryUrl.params.rows, self.data.query.initialOptions.rowsPage);
    // result sorting
    if (queryUrl.getParameter(QueryUrl.params.sort) === undefined)
        queryUrl.setParameter(QueryUrl.params.sort, self.data.query.initialOptions.sort);

    self.event.load(queryUrl.data.url);
};

View.prototype.update = function (url, reGraph) {
    var self = this;
    console.log("update");
    self.data.url = url;
    // UPDATE URL, Only in FF and Chrome :) HTML5
    History.pushState("", "", self.data.url);

    var queryUrl = new QueryUrl(self.data.url);
    var parameterKeys = [QueryUrl.params.query, QueryUrl.params.filterQuery, QueryUrl.params.groups,
        QueryUrl.params.groupsAny, QueryUrl.params.start, QueryUrl.params.rows, QueryUrl.params.sort,
        QueryUrl.params.showId];

    var parameters = {};
    for (var index = 0; index < parameterKeys.length; index++) {
        parameters[parameterKeys[index]] = queryUrl.getParameter(parameterKeys[index]);
        console.log("load general (" + parameterKeys[index] + "): ..." + parameters[parameterKeys[index]]);
    }

    queue()
        .defer(function () {
            if (parameters[QueryUrl.params.showId])
                self._drawDetailView(parameters[QueryUrl.params.showId],
                    parameters[QueryUrl.params.query], parameters[QueryUrl.params.filterQuery]);
        })
        .defer(function () {
            self._drawSelectionPanel(parameters[QueryUrl.params.query], parameters[QueryUrl.params.filterQuery]);
        })
        .defer(function () {
            self._drawFacetsFilterPanel(queryUrl.data.url, parameters[QueryUrl.params.query], parameters[QueryUrl.params.filterQuery]);
        })
        .defer(function () {
            self._drawGraphPanel(parameters[QueryUrl.params.query],
                parameters[QueryUrl.params.filterQuery], parameters[QueryUrl.params.groups],
                parameters[QueryUrl.params.groupsAny], reGraph);
        })
        .defer(function () {
            self._drawResultListPanel(parameters[QueryUrl.params.query],
                parameters[QueryUrl.params.filterQuery], parameters[QueryUrl.params.start],
                parameters[QueryUrl.params.rows], parameters[QueryUrl.params.sort]);
        })
        .defer(function () {
            if (self.subElements.dateRangeFilterPanel)
                self._drawDateRangeFilterPanel(parameters[QueryUrl.params.filterQuery], self.subElements.dateRangeFilterPanel.data.field);
        });
};

//----------------------------------------------------------------------------------------------------------------------
//  draw Panels
//----------------------------------------------------------------------------------------------------------------------
View.prototype._drawSelectionPanel = function (query, filterQuery) {
    var self = this;
    var params = [
        QueryUrl.params.query//,
        //QueryUrl.params.filterQuery
    ];
    var queryUrl = new QueryUrl("/")
        .setParameter(QueryUrl.params.query, query);
    //.setParameter(QueryUrl.params.filterQuery, filterQuery);

    if (QueryUrl.compareUrls(queryUrl.data.url, self.subElements.selectionPanel.data.url, params) === false) {
        self.subElements.selectionPanel.data.url = queryUrl.data.url;
        self.subElements.selectionPanel.draw();
    }
};

View.prototype._drawResultListPanel = function (query, filterQuery, start, rows, sort) {
    var self = this;
    var params = [
        QueryUrl.params.query,
        QueryUrl.params.filterQuery,
        QueryUrl.params.start,
        QueryUrl.params.rows,
        QueryUrl.params.sort
    ];
    var queryUrl = new QueryUrl(baseUrl + "get-documents/")
        .setParameter(QueryUrl.params.query, query)
        .setParameter(QueryUrl.params.filterQuery, filterQuery)
        .setParameter(QueryUrl.params.fields, self.data.fields.resultListEntry)
        .setParameter(QueryUrl.params.start, start)
        .setParameter(QueryUrl.params.rows, rows)
        .setParameter(QueryUrl.params.sort, sort)
        .setParameter(QueryUrl.params.highlightFields, self.data.fields.resultListEntryHighlight);

    if (QueryUrl.compareUrls(queryUrl.data.url, self.subElements.resultPanel.data.url, params) === false) {
        self.subElements.resultPanel.data.url = queryUrl.data.url;
        self.subElements.resultPanel.data.queryAllNodesUrl = self.data.query.getAllNodes;
        self.subElements.resultPanel.draw();
    }
};

View.prototype._drawFacetsFilterPanel = function (url, query, filterQuery) {
    var self = this;
    var params = [
        QueryUrl.params.query,
        QueryUrl.params.filterQuery,
        QueryUrl.params.groups,
        QueryUrl.params.groupsAny
    ];
    if (QueryUrl.compareUrls(url, self.subElements.facetsFilterPanel.data.currentUrl, params) === false) {
        var queryUrl = new QueryUrl(self.data.query.getAllNodes)
            .setParameter(QueryUrl.params.query, query)
            .setParameter(QueryUrl.params.filterQuery, filterQuery);

        self.subElements.facetsFilterPanel.data.url = url;
        self.subElements.facetsFilterPanel.data.queryNodesUrl = queryUrl.data.url;
        self.subElements.facetsFilterPanel.draw();
    }
};

View.prototype._drawDateRangeFilterPanel = function (filterQuery, field) {
    var self = this;

    // todo don't use filterQuery for the range but create an extra url field
    var range = filterQuery.replace(field + ":[", "").replace("]", "");
    var values = range.split(" TO ");
    if(values && values.length === 2)
        self.subElements.dateRangeFilterPanel.data.initialValues = values;

    var queryUrl = new QueryUrl(baseUrl + "get-documents/")
        .setParameter(QueryUrl.params.query, "")
        .setParameter(QueryUrl.params.filterQuery, "")
        .setParameter(QueryUrl.params.fields, field)
        .setParameter(QueryUrl.params.start, "0")
        .setParameter(QueryUrl.params.rows, "1")
        .setParameter(QueryUrl.params.sort, field + " asc")
        .setParameter(QueryUrl.params.highlightFields, "");
    self.subElements.dateRangeFilterPanel.data.urlMinValue = queryUrl.data.url;

    queryUrl.setParameter(QueryUrl.params.sort, field + " desc");
    self.subElements.dateRangeFilterPanel.data.urlMaxValue = queryUrl.data.url;

    self.subElements.dateRangeFilterPanel.draw();

};

View.prototype._drawGraphPanel = function (query, filterQuery, groups, groupsAny, reGraph) {
    var self = this;
    var params = [
        QueryUrl.params.query,
        QueryUrl.params.filterQuery,
        QueryUrl.params.groups,
        QueryUrl.params.groupsAny
    ];
    var queryUrl = new QueryUrl(baseUrl + "get-nodes/")
        .setParameter(QueryUrl.params.query, query)
        .setParameter(QueryUrl.params.filterQuery, filterQuery)
        .setParameter(QueryUrl.params.groups, groups)
        .setParameter(QueryUrl.params.groupsAny, groupsAny)
        .setParameter(QueryUrl.params.limit, self.data.query.initialOptions.nodesLimit);
    console.log("reGraph1: " + reGraph);
    if (reGraph === true || QueryUrl.compareUrls(queryUrl.data.url, self.subElements.graphPanel.data.url, params) === false) {
        console.log("reGraph2: " + reGraph);
        self.subElements.graphPanel.data.url = queryUrl.data.url;
        self.subElements.graphPanel.start();
    }
};

View.prototype._drawDetailView = function (showId, query, filterQuery) {
    var self = this;
    var queryUrl = new QueryUrl(baseUrl + "get-documents/")
        .setParameter(QueryUrl.params.query, query)
        .setParameter(QueryUrl.params.filterQuery, filterQuery)
        .setParameter(QueryUrl.params.fields, self.data.fields.detailView)
        .setParameter(QueryUrl.params.start, 0)
        .setParameter(QueryUrl.params.rows, 1)
        .setParameter(QueryUrl.params.sort, "")
        .setParameter(QueryUrl.params.highlightFields, self.data.fields.detailViewHighlight)
        .appendValueToParameter(QueryUrl.params.filterQuery, "id:" + showId,
        QueryUrl.delimiter.querySplit);

    self.subElements.detailView.data.url = queryUrl.data.url;
    self.subElements.detailView.open();
};

//----------------------------------------------------------------------------------------------------------------------
//  change query settings and request update
//----------------------------------------------------------------------------------------------------------------------
View.prototype._applyFacetFilters = function (ids, value) {
    var self = this;
    var queryUrl = new QueryUrl(self.data.url);
    ids.forEach(function (id) {
        var query = self.data.facetsDataList[id].query;
        if (value)
            queryUrl.appendValueToParameter(QueryUrl.params.filterQuery, query, QueryUrl.delimiter.querySplit);
        else
            queryUrl.removeValueFromParameter(QueryUrl.params.filterQuery, query, QueryUrl.delimiter.AND, QueryUrl.delimiter.querySplit);
    });
    queryUrl.setParameter(QueryUrl.params.start, self.data.query.initialOptions.initialPage);
    self.event.load(queryUrl.data.url);
};

View.prototype._applyDateRangeFilter = function (field, start, end) {
    var self = this;
    var query = field + ":[" + start + " TO " + end + "]";
    var urlQuery = new QueryUrl(self.data.url);
    if (start && end)
        urlQuery.setParameter(QueryUrl.params.filterQuery, query); //todo do not use filterQuery for he range but create extra url field (this is quick and dirty: only possible because filterQuery is otherwise not used)
    urlQuery.setParameter(QueryUrl.params.start, self.data.query.initialOptions.initialPage);
    self.event.load(urlQuery.data.url);
};

View.prototype._applyFreeTextFilter = function (query, value) {
    var self = this;
    var urlQuery = new QueryUrl(self.data.url);
    if (value)
        urlQuery.appendValueToParameter(QueryUrl.params.query, query, QueryUrl.delimiter.querySplit);
    else
        urlQuery.removeValueFromParameter(QueryUrl.params.query, query, QueryUrl.delimiter.AND, QueryUrl.delimiter.querySplit);
    urlQuery.setParameter(QueryUrl.params.start, self.data.query.initialOptions.initialPage);
    self.event.load(urlQuery.data.url);
};

View.prototype._displayDetailView = function (id) {
    var self = this;
    if (!id)
        id = null; //close Detail View
    var queryUrl = new QueryUrl(self.data.url);
    queryUrl.setParameter(QueryUrl.params.showId, id);
    self.event.load(queryUrl.data.url);
};

View.prototype._displayFacetsFilter = function (facetsFilter, value) {
    var self = this;
    var queryUrl = new QueryUrl(self.data.url);
    for (var i = 0; i < facetsFilter.length; i++) {
        if (value)
            queryUrl.appendValueToParameter(QueryUrl.params.groupsAny, facetsFilter[i], QueryUrl.delimiter.COMMA);
        else {
            queryUrl.removeValueFromParameter(QueryUrl.params.groupsAny, facetsFilter[i], QueryUrl.delimiter.COMMA);
            queryUrl.removeValueFromParameter(QueryUrl.params.groups, facetsFilter[i], QueryUrl.delimiter.COMMA, QueryUrl.delimiter.COMMA);
        }
    }
    self.event.load(queryUrl.data.url);
};

View.prototype._displayFacetFilter = function (facetFilter, value) {
    var self = this;
    var queryUrl = new QueryUrl(self.data.url);
    if (value)
        queryUrl.appendValueToParameter(QueryUrl.params.groups, facetFilter, QueryUrl.delimiter.COMMA, QueryUrl.delimiter.COMMA);
    else
        queryUrl.removeValueFromParameter(QueryUrl.params.groups, facetFilter, QueryUrl.delimiter.COMMA, QueryUrl.delimiter.COMMA);
    self.event.load(queryUrl.data.url);
};

//----------------------------------------------------------------------------------------------------------------------
//  highlighting
//----------------------------------------------------------------------------------------------------------------------
View.prototype._highlightFacetFilter = function (id, value) {
    var self = this;
    self.subElements.facetsFilterPanel.setHighlight(id, value);
    self.subElements.resultPanel.setHighlight(id, value);
    self.subElements.graphPanel.highlightNode(id, value);
};

View.prototype._highlightFacetFilters = function (ids, value) {
    var self = this;
    self.subElements.graphPanel.highlightNodeList(ids, value);
    ids.forEach(function (id) {
        self.subElements.facetsFilterPanel.setHighlight(id, value);
    });
};

View.prototype._highlightFacetsFilter = function (facetsFilterId, value) {
    var self = this;
    if (facetsFilterId !== undefined) {
        self.subElements.graphPanel.highlightFacetsFilter(facetsFilterId, value);
    }
};

View.prototype._highlightEdge = function (edge, value) {
    var self = this;
    self.subElements.facetsFilterPanel.setHighlight(edge.source.id, value);
    self.subElements.resultPanel.setHighlight(edge.source.id, value);
    self.subElements.facetsFilterPanel.setHighlight(edge.target.id, value);
    self.subElements.resultPanel.setHighlight(edge.target.id, value);
    self.subElements.graphPanel.highlightEdge(edge, value);
};
