/**
 * Created by Anja Sonnenberg on 20.08.2015.
 *
 * See the file "LICENSE.txt" for the full license and copyright governing this code.
 *
 */
var utils = {
    // Get current queries
    getSelectedQueries: function (url) {
        var urlQuery = new QueryUrl(url);
        var queries = urlQuery.getParameterValueList(QueryUrl.params.query, QueryUrl.delimiter.AND);
        var filterQueries = urlQuery.getParameterValueList(QueryUrl.params.filterQuery, QueryUrl.delimiter.AND);
        return queries.concat(filterQueries);
    },

    // get selected nodes and freetext
    getSelectedFilterValues: function (queries, infoFilters) {
        var infos = [];
        var freeText = [];

        var infoFiltersLookupTable = {};
        for (var key in infoFilters)
            if (infoFilters.hasOwnProperty(key))
                infoFiltersLookupTable[infoFilters[key].query] = key;

        for (var i = 0; i < queries.length; i++) {
            var infoQuery = infoFiltersLookupTable[queries[i]];
            if (infoQuery !== undefined && infoQuery !== null) {
                var info = infoFilters[infoQuery];
                if (info !== undefined && info !== null) {
                    infos.push(info);
                }
            } else {
                freeText.push(queries[i]);
            }
        }
        return [infos, freeText];
    }
};