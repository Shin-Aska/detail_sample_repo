import io
import re
import os
import sys
import json
import pyodbc
import requests
import mssqlify
import datetime
import unicodedata
import pandas as pd
from os import listdir
from urllib.parse import urlparse
from os.path import isfile, join

import logging
logging.getLogger().setLevel(logging.INFO)

import requests
import dateparser
import xlwt 

from xlwt import Workbook
from copy import deepcopy

def init_mssql_connection(server, username, password, database):
	conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER='+server+';DATABASE='+database+';UID='+username+';PWD='+ password)
	return conn

def init_mssql_cursor(conn):
	return conn.cursor()

def execute_mssql_query(conn, cursor, query):
	cursor.execute(query)
	conn.commit()

def it_exists_in_dictionary(key, dictionary):
    try:
        dictionary[key]
        return True
    except:
        return False

def readExcel(filename, worksheet_index):
	workbook = pd.ExcelFile(filename)
	targetsheet = workbook.book.sheet_by_index(worksheet_index)
	rows = targetsheet.nrows
	cnt = 0
	headers = []
	datas = []
	headerFilled = False
	for idx, row in enumerate(targetsheet.get_rows()):
		data = {}
		if len(headers) != 0:
			headerFilled = True
		for idx2, column in enumerate(row):
			if not headerFilled:
				headers.append(column.value)
			else:
				data[headers[idx2]] = column.value
		if headerFilled:
			datas.append(data)
	return datas

if __name__ == "__main__":
	server   = 'detail-ultima.database.windows.net'
	username = 'detail'
	password = '530Av043b2G22vs'
	database = 'H00'

	conn = init_mssql_connection(server, username, password, database)
	cursor = init_mssql_cursor(conn)
	now = datetime.datetime.now() + datetime.timedelta(days=1)
	if len(sys.argv) == 2:
		if sys.argv[1].lower() == "today":
			now = datetime.datetime.now()
		else:
			logging.error("Invalid parameter given")
			sys.exit(-1)
	webshotdata = mssqlify.MSQueryBuilder("officeattach_webshots", ["date", "week", "year", "pcasin", "url", "oem"])
	webshotdata.forceIdentifyAsStringColumn(["pcasin", "oem"])
	webshotdata.identifyNVarcharColumns(["url"])
	records = readExcel("jobs_3.xlsx", 0)

	for row in records:
		try:
			pcasin = str(int(row["pcasin"]))
		except:
			pcasin = str(row["pcasin"])

		webshotdata.addData({
			"date": str(now.year) + "-" + str(now.month).zfill(2) + "-" + str(now.day - 1).zfill(2),
			"week": now.isocalendar()[1],
			"year": now.year,
			"pcasin": pcasin,
			"url": row["url"],
			"oem": row["oem"]
		})
	webshotdata.setBatch(1)
	queries = webshotdata.makeQuery()
	count = 1
	for query in queries:
		try:
			# print(query)
			execute_mssql_query(conn, cursor, query)
		except Exception as e:
			logging.warning("ERROR: %s" % (e))
		logging.info(str(count) + " / " + str(len(queries)))
		count += 1
	pass
