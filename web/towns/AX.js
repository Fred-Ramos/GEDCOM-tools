// Towns of AX (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Mariehamn",6010,1993,2],["Vårdö",6025,2038,8],["Sund",6025,2012,8],["Sottunga",6013,2067,8],["Saltvik",6028,2005,8],["Lumparland",6012,2026,8],["Lemland",6007,2008,8],["Kumlinge",6026,2078,8],["Kökar",5992,2091,8],["Föglö",6001,2041,8],["Brändö",6041,2105,8],["Jomala",6015,1995,8],["Geta",6037,1984,8],["Finström",6027,1993,8],["Eckerö",6021,1961,8],["Yomala",6017,1993,8],["Ytterby",6017,2002,9],["Tjudö",6033,1995,10],["Hammarland",6022,1975,11],["Godby",6023,1999,11],["Bomarsund",6021,2024,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["AX"] = T;
})(typeof window !== "undefined" ? window : globalThis);
