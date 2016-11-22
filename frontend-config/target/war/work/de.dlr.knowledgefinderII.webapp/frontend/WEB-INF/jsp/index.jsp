<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core"%>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt"%>

<div class="row-fluid" id="knowledge-finder-2">
	<div class="col-md-9">
		<div id="freetext">
			<form name="freetextform" class="form-inline" id="freetextform">
				<div class="input-append">
					<input id="search-field" type="text" class="span9 search-query" placeholder="Full-Text Search">
					<button class="btn" type="submit">Add to search</button>
				</div>
			</form>
		</div>
		<div id="currentsel" class="panel-group">
        	<div class="clearfix" id="current-selection"></div>
        </div>
		<div class="panel-group" id="graph-panel">
			<div class="panel panel-default">
				<div class="panel-heading">
					<p class="panel-title">
						<a data-toggle="collapse" data-parent="#graph-panel" href="#graph1">
							<span class="glyphicon glyphicon-plus"></span>
                        	<span class="glyphicon glyphicon-minus"></span>
						</a>
						<span class="name">Data Exploration - Metadata Visualization</span>
					</p>
				</div>
				<div id="graph1" class="panel-collapse collapse in load" style="height: 500px;">
					<div id="panelInfo" class="tooltip"></div>
					<div class="application-loader">
						<div class="loader"></div>
					</div>
				</div>
			</div>
		</div>

		<div id="resultPanel"class="panel-group" >
			<form class="form-inline" id="resultControls" role="form">
				<div class="form-group">
					<label class="control-label" for="sortBy">Sort by:</label>
					<select id="sortBy"></select>
				</div>
				<div class="form-group pull-right">
					<button id="button-collapse-show" type="button" class="btn btn-default btn-lg">Open all</button>
					<button id="button-collapse-hide" type="button" class="btn btn-default btn-lg">Close all</button>
					<div class="btn-group">
						<button id="export-button" type="button" class="btn btn-default btn-lg dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
							Export <span class="caret"></span>
						</button>
						<ul id="export-options" class="dropdown-menu"></ul>
					</div>
				</div>
			</form>
			<div class="load">
				<div class="application-loader">
					<div class="loader"></div>
				</div>
                <p id="stats" class="stats"></p>
                <div id="select">
                	<p class="stats" id="select-stats"><span id="select-info">0</span> entries selected</p>
                	<button id="button-deselect-all" type="button" class="btn btn-default">Deselect all</button>
                </div>
				<ul class="pagination"></ul>
				<div id="results"></div>
				<ul class="pagination"></ul>
			</div>
		</div>
	</div>
	<div class="col-md-3">
		<div class="navigation" >
			<h3>Filter</h3>
			<div class="navmenu panel panel-default">
				<div id="selecttable" class="panel-body list-group load">
					<div class="application-loader">
						<div class="loader"></div>
					</div>
					<div id="facets-filters"></div>
				</div>
			</div>
			<div id="range-filter" class="panel panel-default">
				</div>
		</div>
	</div>
</div>

<jsp:include page="includes/modal.jsp">
	<jsp:param name="idmodal" value="modalDetails" />
</jsp:include>

<script type="text/javascript">
	var baseUrl = '${baseUrl}';
	var filterConfig = JSON.parse('${filterConfig}');
	var detailViewConfig = JSON.parse('${detailViewConfig}');
	var resultConfig = JSON.parse('${resultListConfig}');
	var exportConfig = JSON.parse('${exportConfig}');

	var allFacets = JSON.parse("${allFacets}");
	var allFields = JSON.parse("${allFields}");
</script>
