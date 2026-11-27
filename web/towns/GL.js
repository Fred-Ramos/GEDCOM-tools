// Towns of GL (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Nuuk",6418,-5172,2],["Sisimiut",6694,-5367,5],["Qaqortoq",6072,-4604,5],["Ilulissat",6922,-5110,5],["Aasiaat",6871,-5286,5],["Maniitsoq",6542,-5290,10],["Tasiilaq",6561,-3764,10],["Uummannaq",7067,-5213,11],["Narsaq",6091,-4605,11],["Paamiut",6199,-4967,11],["Nanortalik",6014,-4524,11],["Upernavik",7278,-5615,11],["Qasigiannguit",6882,-5119,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["GL"] = T;
})(typeof window !== "undefined" ? window : globalThis);
