var GraphPanel = function (elementSelector, fieldsDict, facetsDataList) {
    var self = this;
    self.event = d3.dispatch("add", "mouseoverNode", "mouseoutNode", "mouseoverEdge", "mouseoutEdge");
    self.settings = {
        height: null,
        width: null,
        margin: 15,

        maxNodeValue: null,
        minNodeValue: null,
        lowerLimitNodeValue: 0,
        nodeSizeRange: [5, 20],
        nodeTextSizeRange: [8, 20],

        maxEdgeValue: null,
        minEdgeValue: null,
        lowerLimitEdgeValue: 0,
        edgeLengthRange: null,
        edgeWidthRange: [0.02, 5]
    };
    self.data = {
        fieldsDict: fieldsDict,
        facetsDataList: facetsDataList,
        graph: null,
        json: null,
        url: null
    };
    if (!elementSelector)
        elementSelector = "body";
    self.element = d3.select(elementSelector);
    self.subElements = {
        svg: null,
        textMessage: null,
        edges: null,
        nodes: null
    };

    return d3.rebind(self, self.event, "on");
};

GraphPanel.prototype.init = function () {
    console.log("init");
    var self = this;

    if (!self.settings.width)
        self.settings.width = parseInt(self.element.style("width"), 10);
    if (!self.settings.height)
        self.settings.height = parseInt(self.element.style("height"), 10);

    // clean svg with only a text message
    if (!self.subElements.svg) {
        self.subElements.svg = self.element.append("svg")
            .attr("width", self.settings.width)
            .attr("height", self.settings.height);
        self.subElements.textMessage = self.subElements.svg
            .append("g")
            .append("text")
            .attr("class", "graphinfo hide")
            .attr("x", self.settings.width / 2)
            .attr("y", self.settings.height / 2);
        self.subElements.textMessage.attr("text-anchor", "middle");
        // TODO define help-text and styles
        self.subElements.textMessage.text("No nodes, no graph :)");
    } else {
        self.subElements.edges.remove();
        self.subElements.nodes.remove();
    }

    self.subElements.edges = self.subElements.svg.selectAll('.link');
    self.subElements.nodes = self.subElements.svg.selectAll('.gnode');

    var maxEdgeLength = Math.min(self.settings.width, self.settings.height) / 2 - self.settings.margin * 2;
    self.settings.edgeLengthRange = [maxEdgeLength, maxEdgeLength / 1.2];

    self.data.graph = d3.layout.force()
        .charge(-3800) // gravity between nodes
        .chargeDistance(self.settings.width * 2) // max charge distance, better performance
        .friction(0.3) // the particle velocity is scaled by the specified friction
        .gravity(1) // gravity to center
        .on("tick", function () {
            var placeInsideView = function (length, margin, value) {
                return Math.max(margin, Math.min(length - margin, value));
            };
            self.subElements.edges
                .attr("x1", function (d) {
                    return placeInsideView(self.settings.width, self.settings.margin, d.source.x);
                })
                .attr("y1", function (d) {
                    return placeInsideView(self.settings.height, self.settings.margin, d.source.y);
                })
                .attr("x2", function (d) {
                    return placeInsideView(self.settings.width, self.settings.margin, d.target.x);
                })
                .attr("y2", function (d) {
                    return placeInsideView(self.settings.height, self.settings.margin, d.target.y);
                });
            self.subElements.nodes
                .attr("transform", function (d) {
                    d.x = placeInsideView(self.settings.width, self.settings.margin, d.x);
                    d.y = placeInsideView(self.settings.height, self.settings.margin, d.y);
                    return "translate(" + d.x + "," + d.y + ")";
                });
        })
        .size([self.settings.width, self.settings.height]);

    return self;
};

GraphPanel.prototype.start = function () {
    console.log("start");
    var self = this;
    self._displayLoading(true);
    // reset ranges
    self.settings.maxNodeValue = -Infinity;
    self.settings.minNodeValue = Infinity;
    self.settings.maxEdgeValue = -Infinity;
    self.settings.minEdgeValue = Infinity;
    queue().defer(d3.json, self.data.url).await(
        function (error, jsonR) {
            if (error) {
                console.error(error);
                throw error;
            }
            self.data.json = jsonR;
            self._updateNodes();
            self._queueForNeighbors();
        });
};

GraphPanel.prototype._updateNodes = function () {
    var self = this;
    var hashNodes = {};
    self.data.graph.nodes().map(function (node) {
        hashNodes[node.id] = node;
    });
    self.data.graph.nodes([]);
    var svgCenter = {
        x: self.settings.width * 0.5,
        y: self.settings.height * 0.5
    };

    var selectedFilterValues = utils.getSelectedFilterValues(utils.getSelectedQueries(self.data.url), self.data.facetsDataList);
    var selectedFilterIds = selectedFilterValues[0].map(function (filter) {
        return filter.id;
    });

    for (var facetLevel0Name in self.data.json) {
        if (self.data.json.hasOwnProperty(facetLevel0Name)) {
            for (var nodeDataIndex = 0; nodeDataIndex < self.data.json[facetLevel0Name].length; nodeDataIndex++) {
                var nodeData = self.data.json[facetLevel0Name][nodeDataIndex];
                var nodeId = self._generateNodeId(nodeData, facetLevel0Name);
                if (self.data.facetsDataList[nodeId] &&
                        // ensure that the selected facets are not displayed as nodes
                    selectedFilterIds.indexOf(self.data.facetsDataList[nodeId].id) === -1 &&
                        // only display facets with documents as nodes
                    nodeData.count > self.settings.lowerLimitNodeValue) {
                    self.settings.maxNodeValue = Math.max(self.settings.maxNodeValue, parseInt(nodeData.count, 10));
                    self.settings.minNodeValue = Math.min(self.settings.minNodeValue, parseInt(nodeData.count, 10));

                    var node = hashNodes[nodeId];
                    if (node !== undefined) {
                        node.neighbors = [];
                        node.size = nodeData.count;
                    } else {
                        node = {
                            id: nodeId,
                            size: nodeData.count,
                            x: svgCenter.x,
                            y: svgCenter.y
                        };
                    }
                    self.data.graph.nodes().push(node);
                }
            }
        }
    }
};

GraphPanel.prototype._generateNodeId = function (jsonNode, facetLevel0Name) {
    var self = this;
    return self.data.fieldsDict[facetLevel0Name] + "_" + jsonNode.id;
};

GraphPanel.prototype._queueForNeighbors = function () {
    console.log("update Links");
    var self = this;

    if (self.data.graph.nodes().length <= 0)
        self.draw();
    var edgeQueue = queue(1);

    for (var index = 0; index < self.data.graph.nodes().length; index++) {
        var sourceNode = self.data.graph.nodes()[index];
        var facet = self.data.facetsDataList[sourceNode.id];

        if (facet && sourceNode.size > self.settings.lowerLimitNodeValue) {
            var edgeUrl = new QueryUrl(self.data.url);
            // Get sources
            edgeUrl.appendValueToParameter(QueryUrl.params.filterQuery, facet.query, QueryUrl.delimiter.querySplit);
            edgeUrl.setParameter(QueryUrl.params.limit, "-1");
            edgeQueue.defer(d3.json, edgeUrl.data.url);
        }
    }
    edgeQueue.awaitAll(function (error, jsonR) {
        if (jsonR) {
            self._updateEdges(jsonR);
            /*  The first time the graph is drawn, draw() needs to be called twice. Otherwise the graph looks strange...
             There is no problem with the calculations. The nodes are positioned to close to each other,
             but the calculated x and y values seem to be fine. */
            if (self.subElements.nodes[0].length <= 0)
                self.draw();
            self.draw();
        }
    });

    self._displayLoading(false);
};

GraphPanel.prototype._displayLoading = function (value) {
    var self = this;
    self.element.classed("loaded", !value);
};

GraphPanel.prototype._updateEdges = function (jsonData) {
    var self = this;
    var hashNodes = {},
        hashEdges = {};
    self.data.graph.links([]);

    self.data.graph.nodes().map(function (node, index) {
        hashNodes[node.id] = index;
    });

    for (var index = 0; index < jsonData.length; index++) {
        var sourceNode = self.data.graph.nodes()[index];
        for (var facetLevel0Name in jsonData[index]) {
            if (jsonData[index].hasOwnProperty(facetLevel0Name)) {
                for (var dataIndex = 0; dataIndex < jsonData[index][facetLevel0Name].length; dataIndex++) {

                    var targetData = jsonData[index][facetLevel0Name][dataIndex];
                    var targetId = self._generateNodeId(targetData, facetLevel0Name);
                    var targetIndex = hashNodes[targetId];
                    if (targetData.count > self.settings.lowerLimitEdgeValue &&
                        targetIndex !== undefined && targetId != sourceNode.id) {

                        if (!sourceNode.neighbors)
                            sourceNode.neighbors = [targetId];
                        else if (sourceNode.neighbors.indexOf(targetId) === -1)
                            sourceNode.neighbors.push(targetId);

                        self.settings.maxEdgeValue = Math.max(self.settings.maxEdgeValue, parseInt(targetData.count, 10));
                        self.settings.minEdgeValue = Math.min(self.settings.minEdgeValue, parseInt(targetData.count, 10));

                        var edgeId = self._generateEdgeId(sourceNode.id, targetId);
                        var edgeIndex = hashEdges[edgeId];
                        if (edgeIndex === undefined) {
                            var newEdge = {
                                size: targetData.count,
                                target: self.data.graph.nodes()[targetIndex],
                                source: sourceNode,
                                id: edgeId
                            };
                            self.data.graph.links().push(newEdge);
                            hashEdges[edgeId] = self.data.graph.links().indexOf(newEdge);
                        }
                    }
                }
            }
        }
    }
};

GraphPanel.prototype._generateEdgeId = function (source, target) {
    var getId = function (value) {
        if (typeof value === "number" || typeof value === "string")
            return value;
        return value.id;
    };

    var sourceId = getId(source),
        targetId = getId(target);
    if (sourceId > targetId)
        return targetId + "-" + sourceId;
    else
        return sourceId + "-" + targetId;
};

GraphPanel.prototype.draw = function () {
    console.log("draw");
    var self = this;
    self.subElements.textMessage.classed("hide", self.data.graph.nodes().length > 0);
    self._drawNodes();
    self._drawLinks();
    self.data.graph.start();
    return self;
};

GraphPanel.prototype._drawNodes = function () {
    console.log("draw Nodes");
    var self = this;
    var scaleNodeSize = d3.scale.sqrt()
        .domain([self.settings.minNodeValue - 1, self.settings.maxNodeValue]).range(self.settings.nodeSizeRange);
    var scaleNodeTextSize = d3.scale.sqrt()
        .domain([self.settings.minNodeValue - 1, self.settings.maxNodeValue]).range(self.settings.nodeTextSizeRange);

    // update data
    self.subElements.nodes = self.subElements.nodes.data(self.data.graph.nodes(), function (node) {
        return node.id;
    });

    // enter nodes for data with no element
    var newNode = self.subElements.nodes.enter()
        .append("g")
        .attr("class", function (node) {
            return self.data.facetsDataList[node.id].cssClass + " " + "gnode";
        })
        .attr("id", function (node) {
            return node.id;
        })
        .on("mousedown", function (node) {
            self.event.add([node.id]);
        })
        .on("mouseover", function (node) {
            //self._highlightNeighborhoods(node.id, true);
            self.event.mouseoverNode(node.id);
        })
        .on("mouseout", function (node) {
            //self._highlightNeighborhoods(node.id, false);
            self.event.mouseoutNode(node.id);
        })
        .call(self.data.graph.drag);
    newNode.append("circle").attr("class", "node").attr("r", 0);
    newNode.append("text").attr("dx", ".10em").attr("dy", ".4em").style("font-size", "0px");

    self.subElements.nodes.selectAll("circle")
        .transition().duration(3000)
        .attr("r", function (node) {
            return scaleNodeSize(node.size);
        });
    self.subElements.nodes.selectAll("text")
        .transition().duration(3000)
        .style("font-size", function (node) {
            return scaleNodeTextSize(node.size) + "px";
        })
        .text(function (d) {
            return self.data.facetsDataList[d.id].name + " (" + d.size + ")";
        }
    );

    // remove nodes with no data binding
    self.subElements.nodes.exit().selectAll("circle")
        .transition().duration(3000).attr("r", 0)
        .remove();
    self.subElements.nodes.exit().remove();
};

GraphPanel.prototype._drawLinks = function () {
    console.log("draw Links");
    var self = this;
    var scaleEdgeLength = d3.scale.linear()
        .domain([self.settings.minEdgeValue - 1, self.settings.maxEdgeValue]).range(self.settings.edgeLengthRange);
    var scaleEdgeWidth = d3.scale.linear()
        .domain([self.settings.minEdgeValue - 1, self.settings.maxEdgeValue]).range(self.settings.edgeWidthRange);

    // update data
    self.data.graph.linkDistance(function (edge) {
        return scaleEdgeLength(edge.size);
    });
    self.subElements.edges = self.subElements.edges.data(self.data.graph.links(), function (edge) {
        return edge.id;
    });

    // enter edges for data with no element
    self.subElements.edges.enter().insert("line", ".gnode").attr("class", "link")
        .on("click", function (edge) {
            self.event.add([edge.target.id, edge.source.id]);
        })
        .on("mouseover", function (edge) {
            self.event.mouseoverEdge(edge);
        })
        .on("mouseout", function (edge) {
            self.event.mouseoutEdge(edge);
        });

    self.subElements.edges.transition().duration(3000)
        .style("stroke-width", function (edge) {
            return scaleEdgeWidth(edge.size);
        });

    // remove edges with no data binding
    self.subElements.edges.exit().remove();
};

//----------------------------------------------------------------------------------------------------------------------
// highlighting
//----------------------------------------------------------------------------------------------------------------------
GraphPanel.prototype.highlightNode = function (id, value) {
    var self = this;
    if (value)
        self._showNodeInPanelInfo(id);
    else
        self._hidePanelInfo();
    self._highlightNeighborhoods(id, value);
};

GraphPanel.prototype.highlightEdge = function (edge, value) {
    var self = this;
    self._highlightNeighborhoods([edge.target.id, edge.source.id], value);
    if (value)
        self._showPathInPanelInfo(edge);
    else
        self._hidePanelInfo();
};

GraphPanel.prototype._highlightNeighborhoods = function (ids, value) {
    var self = this;
    if (ids !== undefined) {
        if (!Array.isArray(ids))
            ids = [ids];
        var nodes = self.subElements.nodes.filter(function (node) {
            return ids.indexOf(node.id) !== -1;
        });
        nodes.classed("fadeup", value); //highlight node
        var unconnectedNodeIds = [];
        nodes.each(function (node) {
            unconnectedNodeIds = unconnectedNodeIds.concat([node.id]);
            unconnectedNodeIds = unconnectedNodeIds.concat(node.neighbors);
        });
        self._fadeoutRemainingNodes(unconnectedNodeIds, value);
    }
};

GraphPanel.prototype.highlightNodeList = function (ids, value) {
    var self = this;
    if (ids)
        self._fadeoutRemainingNodes(ids, value);
};

GraphPanel.prototype.highlightFacetsFilter = function (facetId, value) {
    var self = this;
    if (facetId) {
        var nodeIds = [];
        self.subElements.nodes
            .filter(function (node) {
                return self.data.facetsDataList[node.id].group === facetId;
            })
            .each(function (node) {
                nodeIds.push(node.id);
            });
        self._fadeoutRemainingNodes(nodeIds, value);
    }
};

GraphPanel.prototype._fadeoutRemainingNodes = function (nodeIds, fadeout) {
    var self = this;
    self.subElements.nodes.classed("fadeout", function (node) {
        var inGroup = nodeIds.indexOf(node.id) !== -1;
        return (fadeout && !inGroup);
    });
    self.subElements.edges.classed("fadeout", function (edge) {
        var inGroup = nodeIds.indexOf(edge.source.id) !== -1 && nodeIds.indexOf(edge.target.id) !== -1;
        return (fadeout === true && !inGroup);
    });
};

GraphPanel.prototype._showInfo = function (html) {
    var divInfo = d3.select("#panelInfo");

    if (html !== null && html !== undefined) {
        divInfo.transition().duration(500).style("opacity", 1);
        divInfo.html(html);
    } else {
        divInfo.transition().duration(500).style("opacity", 1e-6);
    }
};

GraphPanel.prototype._showNodeInPanelInfo = function (nodeId) {
    var self = this;
    var html = "<b>" + self.data.facetsDataList[nodeId].name + "</b> </br>";
    html += "Total documents with this property " + self.data.facetsDataList[nodeId].size + "</br>";
    html += "Some info Extra to show here....";
    // hide
    self._showInfo(html);
};

GraphPanel.prototype._showPathInPanelInfo = function (path) {
    var self = this;
    var source = self.data.facetsDataList[path.source.id];
    var target = self.data.facetsDataList[path.target.id];

    var html = "<b>" + source.name + " - " + target.name + "</b> </br>";
    html += "Current documents with both properties " + path.size + "</br>";
    html += "Some info Extra to show here....";
    // hide
    self._showInfo(html);
};

GraphPanel.prototype._hidePanelInfo = function () {
    var self = this;
    self._showInfo(null);
};