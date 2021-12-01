// BEWARE, PLEASE USE CAMEL CASING ON EVERYTHING
// EXCEPT TEMPORARY VARIABLES AND CLASS ATTRIBUTES
// THANKS, LOVE LOVE <3

var disableProxy = false;
if (typeof process.env.disableProxy !== 'undefined') {
	disableProxy = process.env.disableProxy.toLowerCase() == "true";
}

var fs = require('fs');
const sql = require('mssql');
var request = require('request');
var beautify = require("json-beautify");
var Canvas = require("canvas");

var folder = "template";
var server = "http://127.0.0.1:12500";

var readJSONContent = function(filename) {
	var contents = fs.readFileSync(filename, 'utf8');
	return JSON.parse(contents);
}

var a = JSON.parse(fs.readFileSync('azure.json', 'utf8'));
process.env.azureaccount = a.account;
process.env.azurekey = a.key;
process.env.azurestoragelocation = a.storage;

var AzureStorage = require("./azurewrapper");

const config = {
	server:     'detail-ultima.database.windows.net',
	user:       'detail',
	password:   '530Av043b2G22vs', 
    database:   'H00',
    options:    {
        encrypt:    true
    }
};

var debug = true;
var service = new AzureStorage(process.env.azureaccount, process.env.azurekey);

function format(str) {
	if (str < 10) {
		return "0" + str;
	}
	else {
		return str + "";
	}
}

function getTimestring() {
	var date = new Date();
	var second = date.getUTCSeconds();
	var minute = date.getUTCMinutes();
	var hour = date.getUTCHours() - 6;
	if (hour < 0) {
		hour = hour + 23;
	}
	return format(hour) + "-" + format(minute) + "-" + format(second);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

let connection = "";
async function execute() {
	if (connection == "") {
		connection = await sql.connect(config);
	}
	var t_date = "";
	if (process.env.date == "today") {
		var n = new Date();
		t_date = n.getUTCFullYear() + "-" + (n.getUTCMonth() + 1) + "-" + n.getUTCDate();
	}
	else {
		t_date = process.env.date;
	}

	var m = new Date();

	var month = m.getUTCMonth() + 1;

	if(month <= 9){
		month = '0'+ (m.getUTCMonth() + 1)
	}

	t_date = m.getUTCFullYear() + "-" + month + "-" + m.getUTCDate();

	var result = await sql.query("SELECT TOP 1 id, pcasin, url, oem, webshot_url_pdp, date FROM officeattach_webshots WHERE (webshot_url_pdp IS NULL AND webshot_url_promo IS NULL) AND date = '"+ t_date +"' ORDER BY NEWID()");
	// var result = await sql.query("SELECT TOP 1 id, pcasin, url, oem, webshot_url_pdp, date FROM officeattach_webshots WHERE (webshot_url_pdp IS NULL AND webshot_url_promo IS NULL) AND date = '2020-12-01' AND url LIKE '%amazon%' ORDER BY NEWID()");
	// var result = await sql.query("SELECT TOP 1 id, pcasin, url, oem, webshot_url_pdp, date FROM officeattach_webshots WHERE (webshot_url_pdp IS NULL AND webshot_url_promo IS NULL) ORDER BY NEWID()");
	console.log(result.recordset.length + " records fetched");
	console.log(result);
	if (result.recordset.length != 0) {
		let data = result.recordset[0];
		var ts = getTimestring();
		var ds = data["date"].getFullYear() + "-" + (data["date"].getMonth() + 1) + "-" + data["date"].getDate();
		var file_name = ds + "@" + data["pcasin"] + "@" + data["oem"] + "@" + ts + "_DXT";
		var strategy;

		if(data["url"].includes("amazon")){
			strategy = require("./template/amazon.js");
		}else if(data["url"].includes("bestbuy")){
			strategy = require("./template/bestbuy_com.js");
		}else if(data["url"].includes("costco")){
			strategy = require("./template/costco_com.js");
		}else if(data["url"].includes("microcenter")){
			strategy = require("./template/micro_center_com.js");
		}else if(data["url"].includes("newegg")){
			strategy = require("./template/newegg_com.js");
		}else if(data["url"].includes("officedepot")){
			strategy = require("./template/office_depot.js");
		}else if(data["url"].includes("staples")){
			strategy = require("./template/staples_com.js");
		}else if(data["url"].includes("walmart")){
			strategy = require("./template/walmart_com.js");
		}

		var success = await strategy(file_name, data["url"]);
		console.log(success);
		if (success) {

			// Need to ensure that there is atleast a buffer for consistency
			await sleep(2500);
			
			var webshot_url_pdp = await service.upload("aks-ws", file_name + "-pdp.png", file_name + "-pdp.png").then((r) => {
				console.log("[MSCommercial Office Attach] > " + r.name + " succesfully uploaded with the url: " + r.url);
				return r.url;
			}).catch((error) => {
				console.log("[MSCommercial Office Attach] > Exception occured" + error);
			});

			var webshot_url_promo = await service.upload("aks-ws", file_name + "-promo.png", file_name + "-promo.png").then((r) => {
				console.log("[MSCommercial Office Attach] > " + r.name + " succesfully uploaded with the url: " + r.url);
				return r.url;
			}).catch((error) => {
				console.log("[MSCommercial Office Attach] > Exception occured" + error);
			});

			// try{
			// 	var webshot_url_add_to_cart = await service.upload("aks-ws", file_name + "-add-to-cart.png", file_name + "-add-to-cart.png").then((r) => {
			// 		console.log("[MSCommercial Office Attach] > " + r.name + " succesfully uploaded with the url: " + r.url);
			// 		return r.url;
			// 	}).catch((error) => {
			// 		console.log("[MSCommercial Office Attach] > Exception occured" + error);
			// 	});
			// }catch(ex){
			// 	var webshot_url_add_to_cart = null;
			// }

			// try{
			// 	var webshot_url_in_cart = await service.upload("aks-ws", file_name + "-in-cart.png", file_name + "-in-cart.png").then((r) => {
			// 		console.log("[MSCommercial Office Attach] > " + r.name + " succesfully uploaded with the url: " + r.url);
			// 		return r.url;
			// 	}).catch((error) => {
			// 		console.log("[MSCommercial Office Attach] > Exception occured" + error);
			// 	});
			// }catch(ex){
			// 	var webshot_url_in_cart = null;
			// }

			// try{
			// 	var webshot_url_store_locator = await service.upload("aks-ws", file_name + "-store-locator.png", file_name + "-store-locator.png").then((r) => {
			// 		console.log("[MSCommercial Office Attach] > " + r.name + " succesfully uploaded with the url: " + r.url);
			// 		return r.url;
			// 	}).catch((error) => {
			// 		console.log("[MSCommercial Office Attach] > Exception occured" + error);
			// 	});
			// }catch(ex){
			// 	var webshot_url_store_locator = null;
			// }

			// await sql.query("UPDATE officeattach_webshots SET webshot_url_pdp = N'" + webshot_url_pdp + "', webshot_url_promo = N'" + webshot_url_promo + "', webshot_url_add_to_cart = N'" + webshot_url_add_to_cart + "' , webshot_url_in_cart = N'" + webshot_url_in_cart + "', webshot_url_store_locator = N'" + webshot_url_store_locator + "' WHERE id = " + data["id"]);
			// if (debug) {
			// 	console.log("Record ID " + data["id"] + " has a webshot_urls [" + webshot_url_pdp + ", " + webshot_url_promo + ", " + webshot_url_add_to_cart + ", " + webshot_url_in_cart + ", " + webshot_url_store_locator + "]");
			// }

			await sql.query("UPDATE officeattach_webshots SET webshot_url_pdp = N'" + webshot_url_pdp + "', webshot_url_promo = N'" + webshot_url_promo + "' WHERE id = " + data["id"]);
			if (debug) {
				console.log("Record ID " + data["id"] + " has a webshot_urls [" + webshot_url_pdp + ", " + webshot_url_promo + "]");
			}
		}
	}
	setTimeout(execute, 2000);
} execute();
