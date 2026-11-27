// Towns of AS (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Pago Pago",-1428,-17070,2],["Taulaga",-1106,-17109,5],["Ta`ū",-1423,-16951,5],["Ofu",-1417,-16968,8],["Tāfuna",-1434,-17072,8],["Nu‘uuli",-1432,-17070,9],["Leone",-1434,-17078,9],["Faleniu",-1433,-17074,9],["Ili‘ili",-1435,-17075,10],["Aūa",-1427,-17067,10],["Mapusagafou",-1432,-17075,10],["Fagatogo",-1428,-17069,10],["Mapusaga",-1432,-17076,10],["Vaitogi",-1435,-17074,11],["Malaeimi",-1432,-17073,11],["Vailoatai",-1435,-17078,11],["Faleāsao",-1422,-16951,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["AS"] = T;
})(typeof window !== "undefined" ? window : globalThis);
