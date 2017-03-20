# 4N-GX Geiger Counter

Make use of a [4N-Galaxy Geiger Counter](http://www.4n-gx.de/geiger_zahler_strahlung_messen.html).

## Usage

``` javascript

var geigercounter = require("geiger-4ngx")("/dev/ttyUSB0");

geigercounter.on("data", function(data){
	
	console.log(data);
	
});

```

