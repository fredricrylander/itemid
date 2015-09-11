
Distributed site-unique 64-bit user IDs
=======================================
The idea with `ItemId` is to allow for site-unique IDs that are practical to use in several areas of a Node.js site. Easily generated in JavaScript and at the same time a good fit for primary IDs in databases.

The IDs are 64-bit integers. Represented in JavaScript by two 32-bit ints or a 16 character long hexadecimal string.

The solution allows for up to 256 machines to simultaniously create 4096 unique IDs (i.e. up to 1,048,576 unique IDs) per millisecond without the need for any type of centralisation or crosstalk between servers.

Inspiration
-----------
The `ItemId`-object was inspired by [Instagram’s blog article](http://instagram-engineering.tumblr.com/post/10853187575/sharding-ids-at-instagram) about how they shard IDs, as well as from [MongoDB’s ObjectId specification](http://docs.mongodb.org/manual/reference/object-id/).

Overview
--------
`ItemId`s are made up of three parts, **1**) a millisecond timestamp, **2**) a counter value, and **3**) a machine ID.

### 1. Timestamp (44 bits)
The first 44 bits denote a millisecond timestamp since midnight on the 1 of January, 1970. 44 bits of milliseconds may represent >557 years, which gives us unique IDs until the year 2527 (0xfffffffffff/1000/60/60/24/365.25 ~= 557.)

**NOTE:** The rollover will happen in the year 2248 if your database does not handle unsigned 64-bit integers, e.g. PostgreSQL (more info is available in the inline doc for `toPostgreSQL()`.)


### 2. Counter (12 bits)
The next 12 bits denote a counter value that is kept for each machine, starting with a random value. This will enable each machine to genrate up to 4096 unique IDs every millisecond. Note that the counter is not monotonically rising for each millisecond, i.e. the counter is not bound to the millisecond value (it is not restarted for each millisecond) and therefor does not enforce a strict order for new IDs generated within the same millisecond. IDs produced whithin the same millisecond should be thought of as having random order.


### 3. Machine ID (8 bits)
The last 8 bits denote the machine ID, allowing for up to 256 machines to cooperate simultaneously without the need for communication.

API Documentation
-----------------
I’m afraid the only API doc is the inline doc at this point.
