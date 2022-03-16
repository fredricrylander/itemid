
Distributed site-unique 64-bit user IDs
=======================================
The idea with `ItemId` is to allow for site-unique IDs that are practical to use in several areas of a Node.js site. Easily generated in JavaScript and at the same time a good fit for primary IDs in databases.

The IDs are 64-bit integers. Represented in JavaScript by two 32-bit ints or a 16 character long hexadecimal string.

The solution allows for up to 256 machines to simultaneously create 4096 unique IDs (i.e. up to 1,048,576 unique IDs) per millisecond without the need for any type of centralization or crosstalk between servers.

Installation
------------
`npm install --save itemid`

**NOTE:** If this module is used together with MongoDB then it is important that `ItemId` requires the same `bson` module as `mongodb-core` does. It may help to reduce module duplication in the project’s module tree by running the following command in the project’s root directory.

`npm dedup bson`

Consider adding the `dedup` command to the project’s `postinstall` script hook.

```json
"scripts": {
  "postinstall": "npm dedup bson"
}
```

Inspiration
-----------
The `ItemId`-object was inspired by [Instagram’s blog article](http://instagram-engineering.tumblr.com/post/10853187575/sharding-ids-at-instagram) about how they shard IDs, as well as by [MongoDB’s ObjectId specification](http://docs.mongodb.org/manual/reference/object-id/).

Overview
--------
`ItemId`s are made up of three parts, **1**) a millisecond timestamp, **2**) a counter value, and **3**) a machine ID.

### 1. Timestamp (44 bits)
The first 44 bits denote a millisecond timestamp since midnight on the 1 of January, 1970. 44 bits of milliseconds may represent >557 years, which gives us unique IDs until the year 2527 (0xfffffffffff/1000/60/60/24/365.25 ~= 557.)

**NOTE:** The rollover will happen in the year 2248 if your database does not handle unsigned 64-bit integers, e.g. PostgreSQL (more info is available in the inline doc for `toPostgreSQL()`.)


### 2. Counter (12 bits)
The next 12 bits denote a counter value that is kept for each machine, starting with a random value. This will enable each machine to genrate up to 4096 unique IDs every millisecond. Note that the counter is not monotonically rising for each millisecond, i.e. the counter is not bound to the millisecond value (it is not restarted for each millisecond) and therefor does not enforce a strict order for new IDs generated within the same millisecond. IDs produced whithin the same millisecond should be thought of as having random order.


### 3. Machine ID (8 bits)
The last 8 bits denote the machine ID, allowing for up to 256 machines to cooperate simultaneously without the need for communication. By default the machine ID is based on the machine’s hostname, but it can be set via `setMachineId()`.

Quick Guide
-----------
```javascript
const ItemId = require('itemid');

// Create a new ID object (e.g. to use in a MongoDB query):
const id = new ItemId();

// Instantiate a new ItemId object with a given string ID:
const knownId = new ItemId('143e899570000101');

// Create a new string ID:
const strId = ItemId.newId();

// Validate a string ID:
const isValid = ItemId.test(strId);

// Create a boundary ID, e.g. to use in a lower/higher-than query:
const boundaryId = ItemId.createFromTime(Date.UTC(2014, 0, 31));

// Extract the date and timestamp from an ID:
const date = id.getDate();
const ts   = id.getTimestamp();

// Extract the ID of the machine that the ID was created on:
const machineId = id.getMachineId();
```

Use with MongoDB
----------------
```javascript
// Note that the prototype extensions on `Long` enables the `_id` value of
// a returned MongoDB document to be automagically converted into an
// ItemId-string by `JSON.stringify()`. E.g. create a new user document:
db.users.insert({
	_id: new ItemId(),
	email: 'name@example.com'
});

// And then, retrieve and return the same user document:
db.users.findOne(
	{ email: 'name@example.com' },
	(err, user) => {
		if (err) throw err;
		if (user) res.send(200, { user: user }) else res.send(404);
	}
);

// The returned data would look like:
{ 'user': { '_id': '147ac2eee0a0963d', 'email': 'name@example.com' } }
```

Use with MySQL and/or PostgreSQL
--------------------------------
```javascript
const id = new ItemId();

// Use `toMySQL()` or `toPostgreSQL()` when inserting rows, e.g.:
connection.query('INSERT INTO users SET ?', {
	id: id.toMySQL(),
	email: 'name@example.com'
});

// And cast IDs to hexadecimal representation when selecting data in MySQL:
connection.query('SELECT HEX(id) AS id, email FROM users', function () {...});

// As well as in PostgreSQL:
client.query('SELECT to_hex(id) AS id, email FROM users', function () {...});
```
