/**
 * Distributed site-unique 64-bit user IDs
 * =======================================
 *
 * The idea with ItemId is to allow for site-unique IDs that are practical
 * to use in several areas of a Node.js site. Easily generated in JavaScript
 * and at the same time a good fit for primary IDs in databases.
 *
 * The IDs are 64-bit integers. Represented in JavaScript by two 32-bit ints
 * or a 16 character long hexadecimal string.
 *
 * The solution allows for up to 256 machines to simultaniously create 4096
 * unique IDs (i.e. up to 1,048,576 unique IDs) per millisecond without the
 * need for any type of centralisation or crosstalk between servers.
 *
 *
 * Inspiration
 * -----------
 *
 * The ItemId-object was inspired by Instagram’s blog article:
 *
 * - http://instagram-engineering.tumblr.com/post/10853187575/sharding-ids-at-instagram
 *
 * As well as from MongoDB’s ObjectId specification:
 *
 * - http://docs.mongodb.org/manual/reference/object-id/
 *
 *
 * Usage
 * -----
 *
 * ```js
 *     var ItemId = require('itemid').ItemId;
 *
 *     // Create a new ID object (e.g. to use in a MongoDB query):
 *     var id = new ItemId();
 *
 *     // Instantiate a new ItemId object with a given ID:
 *     var knownId = new ItemId('143e899570000101');
 *
 *     // Create a new string ID:
 *     var strId = ItemId.newId();
 *
 *     // Create a boundary ID, e.g. to use in a lower/higher-than query:
 *     var boundaryId = ItemId.createFromTime(Date.UTC(2014, 0, 31));
 *
 *     // Set the machine ID for a specific machine:
 *     ItemId.setMachineId(255);
 *
 *     // Getting the ID from a `Long` type, e.g. in a MongoDB
 *     // query callback (`doc` being the retrieved document):
 *     var idFromLong = ItemId.createFromLong(doc._id);
 *
 *     // Prototype extension version (the prototype extension only works
 *     // if this module uses the very same `bson` module as the current
 *     // MongoDB client does!):
 *     var idFromLong = doc._id.newItemId();
 *
 *     // Getting the string representation from a `Long` type,
 *     // e.g. in a MongoDB query callback (`doc` being the retrieved
 *     // document):
 *     var strIdFromLong = ItemId.strFromLong(doc._id);
 *
 *     // Prototype extension versions. The `Long` type’s `toString`
 *     // and `toJSON` functions has been extended in order to return the long
 *     // value in its hexadecimal string form (the prototype extensions only
 *     // works if this module uses the very same `bson` module as the current
 *     // MongoDB client does!):
 *     var strIdFromLong = doc._id.toString();
 *     var strIdFromLong = doc._id.toJSON();
 *
 *     // Note that the prototype extensions enable the "_id" value to
 *     // automagically be converted into an ItemId-string by
 *     // `JSON.stringify()` to JSON. Thus a typical way to work with ItemId’s
 *     // could look like the following, first inserting a new user:
 *     db.users.insert({ _id: new ItemId(), email: 'name@example.com' });
 *
 *     // And then, retrieve the same user:
 *     db.users.findOne({ email: 'name@example.com' }, function (err, user) {
 *         if (err) throw err;
 *         if (user) res.send(200, { user: user }) else res.send(404);
 *     });
 *
 *     // The returned data would look something like:
 *     { 'user': { '_id': '147ac2eee0a0963d', 'email': 'name@example.com' } }
 * ```
 *
 *
 * Overview
 * --------
 *
 * ItemIDs are made up of three parts, 1) a millisecond timestamp,
 * 2) a counter value, and 3) a machine ID.
 *
 *
 * ### 1. Timestamp (44 bits)
 *
 * The first 44 bits denote a millisecond timestamp since midnight on the
 * 1 of January, 1970. 44 bits of milliseconds may represent >557 years,
 * which gives us unique IDs until 2527
 * (0xfffffffffff/1000/60/60/24/365.25 ~= 557.)
 *
 * NOTE: if your database, e.g. PostgreSQL, does not have an unsigned 64-bit
 * integer type, then the rollover will happen in 2248. A description of why
 * is available in the documentation for `toPostgreSQL()`.
 *
 *
 * ### 2. Counter (12 bits)
 *
 * The next 12 bits denote a counter value that is kept for each machine,
 * starting with a random value. This will enable each machine to genrate
 * up to 4096 unique IDs every millisecond. Note that the counter is not
 * monotonically rising for each millisecond, i.e. the counter is not bound
 * to the millisecond value (it is not restarted for each millisecond) and
 * therefor does not enforce a strict order for new IDs generated within
 * the same millisecond. IDs produced whithin the same millisecond can be
 * thought of as having random order.
 *
 *
 * ### 3. Machine ID (8 bits)
 *
 * The last 8 bits denote the machine ID, allowing for up to 256 machines
 * to cooperate simultaneously without the need for communication.
 *
 *
 * @author Fredric Rylander, https://github.com/fredricrylander
 * @date 2014-01-31
 * @license MIT
 */


'use strict';

// Import must-have libraries.
var crypto = require('crypto');
var Long   = require('mongodb-core').BSON.Long;
var os     = require('os');
var util   = require('util');


// Private Constants ==========================================================

// Regex matching 16 character long hexadecimal strings.
var ITEM_ID_regex = /^[0-9a-fA-F]{16}$/;


// Private Unit-global Variables ==============================================

// Initate the user ID counter with a random number.
var ITEM_ID_counter = parseInt(Math.random() * 0xfff, 10);

// Initiate the machine ID constant.
var ITEM_ID_machine_id = null;


// Public Interface ===========================================================

/**
 * ItemId Constructor
 *
 * The constructor may be called with an empty argument list in which case
 * a new ID is constructed. It may also be called with a single argument if
 * it is a string representation of an ItemId (i.e. a 16 character long
 * hexadecimal string,) or it may be called with two integer arguments, the
 * first one representing the low 32-bits of the ID and the second argument
 * representing the high 32-bits of the ID.
 *
 * @class ItemId
 * @param {string} [arg1] (Optional) string value to instantiate as an ItemId.
 *     The value is expected to be a 16 character long hexadecimal string,
 *     without any '0x'-prefix.
 * @param {integer} [arg1] (Optional) The low 32-bits of the ID.
 * @param {integer} [arg2] (Optional) The high 32-bits of the ID.
 */
var ItemId = function (arg1, arg2) {
    // Make sure an object is used.
    if (!(this instanceof ItemId)) {
        return new ItemId(arg1, arg2);
    }

    // The constructor may have been called with an empty argument list, a
    // hexadecimal string ID or two 32-bit values (representing low/high
    // parts of the 64-bit ID.)
    var low = 0;
    var high = 0;
    if (arguments.length < 2) {
        // Use the specified ID or construct a new one.
        var id = arg1 ? arg1 + '' : newId();

        // Split the ID into low and high parts.
        low = parseInt(id.slice(-8), 16);       // Low 32 bits.
        high = parseInt(id.slice(-16, -8), 16); // High 32 bits.
    }
    // Assume the two given arguments are low/high parts of the 64-bit integer.
    else {
        low = arguments[0];
        high = arguments[1];
    }

    // Complain if the incoming arguments were faulty.
    if (Number.isNaN(low) || Number.isNaN(high)) {
        var message = 'ItemId: ';
        switch (arguments.length) {
            case 1:
                message += 'expected a hexadecimal string of 64 bits: ' + arguments[0];
                break;

            case 2:
                message += 'expected two 32-bit values, low: ' + arguments[0] + ', high: ' + arguments[1];
                break;

            default:
                message += 'unexpected error when creating a new ID, high: ' + high + ', low: ' + low;
        }
        throw new Error(message);
    }

    // Call the super-constructor.
    Long.call(this, low, high);
};

// The `ItemId` class inherits from the `Long` class, i.e. works as
// a 64-bit integer in MongoDB.
util.inherits(ItemId, Long);


/**
 * Performs a lexicographical comparison of the IDs (basically mimicing the
 * behaviour of the C function `strcmp()`, i.e. returning zero for equality,
 * greater than zero if the current ID is greater than the given one, or less
 * than zero to indicate the opposite.)
 *
 * @param {ItemId} id The user ID to compare with the current one.
 * @return {integer} `0` if the two are equal, `greater than 0` if the
 *     current ID is greater than the given one, or `less than 0` to
 *     indicate the opposite.
 */
ItemId.prototype.compare = function (id) {
    // The two objects’ values should be unsigned ints when comparing them.
    var thisHi = this.high_ >= 0 ? this.high_ : this.high_ + 0x100000000;
    var thatHi = id.high_ >= 0 ? id.high_ : id.high_ + 0x100000000;

    if (thisHi === thatHi) {
        var thisLo = this.low_ >= 0 ? this.low_ : this.low_ + 0x100000000;
        var thatLo = id.low_ >= 0 ? id.low_ : id.low_ + 0x100000000;
        return thisLo > thatLo ? 1 : (thisLo < thatLo ? -1 : 0);
    }

    return thisHi > thatHi ? 1 : -1;
};

/**
 * Returns the current ID’s property values as an object.
 *
 * @param {boolean} toConsole Set to `false` in order to stop the object’s
 *     property values to be echoed to the console, defaults to `true`.
 * @return {Object} An object with the ID’s current property values.
 */
ItemId.prototype.dump = function (toConsole) {
    var data = {
        valueOf: this.valueOf(),
        high_: this.high_,
        low_: this.low_,
        getTimestamp: this.getTimestamp(),
        getCounter: this.getCounterValue(),
        getMachineId: this.getMachineId(),
        getDate: this.getDate(),
        toString: this.toString(),
        toMySQL: this.toMySQL(),
        toPostgreSQL: this.toPostgreSQL()
    };
    if (toConsole || typeof toConsole === 'undefined') {
        console.dir(data);
    }
    return data;
};

/**
 * Compares the equality of the current ID and the given one.
 *
 * @param {ItemId} id The user ID to compare with the current one.
 * @return {boolean} `true` if the two are equal, else `false`.
 */
ItemId.prototype.equal = function (id) {
    return this.high_ === id.high_ && this.low_ === id.low_;
};

/**
 * Returns the current user ID’s counter value.
 *
 * @return {integer} The counter value from the current user ID.
 */
ItemId.prototype.getCounterValue = function () {
    return (this.getLowBitsUnsigned() >>> 8) & 0xfff;
};

/**
 * Returns the date that the ID was generated.
 *
 * @return {Date} The date that the ID was generated.
 */
ItemId.prototype.getDate = function () {
    return new Date(this.getTimestamp());
};

/**
 * Returns the ID of the machine that constructed the current user ID.
 *
 * @return {integer} The machine ID from the current user ID.
 */
ItemId.prototype.getMachineId = function () {
    return this.getLowBitsUnsigned() & 0xff;
};

/**
 * Returns the timestamp from when the ID was generated (i.e. the number of
 * milliseconds elapsed since 1 January 1970 00:00:00 UTC.)
 *
 * @return {integer} The timestamp from when the ID was generated.
 */
ItemId.prototype.getTimestamp = function () {
    // Cannot use bit operations since they force the operands
    // into signed 32 bit integers.
    // var timestamp = (this.high_ << 12) | (this.low_ >>> 20);
    var high = this.high_ >= 0 ? this.high_ : this.high_ + 0x100000000;
    return Math.floor((high * 4096) + (this.getLowBitsUnsigned() / 1048576));
};

/**
 * Returns the JSON representation of the ID, effectively the same
 * as `valueOf()`.
 *
 * @return {string} The JSON representation of the ID.
 * @see valueOf
 */
ItemId.prototype.toJSON = function () {
    return stringify(this.low_, this.high_);
};

/**
 * In order to get the hexadecimal representation back out,
 * use `SELECT HEX(id) AS 'id'`.
 *
 * More info:
 * - http://dev.mysql.com/doc/refman/5.7/en/integer-types.html
 * - http://dev.mysql.com/doc/refman/5.7/en/hexadecimal-literals.html
 * - http://dev.mysql.com/doc/refman/5.7/en/cast-functions.html#function_cast
 */
ItemId.prototype.toMySQL = function () {
    return "CAST(X'" + stringify(this.low_, this.high_) + "' AS UNSIGNED)";
};

/**
 * In order to get the hexadecimal representation back out, use
 * `SELECT to_hex(id) AS 'id'`.
 *
 * NOTE:
 * PostgreSQL currently does not have any unsigned 64-bit integer type! It
 * is not a problem for this class per se since it is only interested in the
 * hexadecimal representation and it will not care about the decimal two’s
 * complement value. The only problem would be that PostgreSQL will sort items
 * according to the two’s complement representation and hence place all items
 * that uses the most significant bit (bit 64) before, and in reversed order,
 * to all other items in the table. The end result is that dates with a year
 * between 2248 and 2527 (i.e. from about 278 to 557 years after Unix epoch
 * in 1970) will be affected by this problem. (Note that the timestamp rolls
 * over in the year 2527.)
 *
 * More info:
 * - http://www.postgresql.org/docs/9.3/static/datatype-numeric.html
 * - http://www.postgresql.org/docs/9.3/static/functions-string.html
 * - http://www.postgresql.org/docs/9.3/interactive/sql-expressions.html#SQL-SYNTAX-TYPE-CASTS
 */
ItemId.prototype.toPostgreSQL = function () {
    return "CAST(X'" + stringify(this.low_, this.high_) + "' AS bigint)";
};

/**
 * Returns the string representation of the user ID.
 *
 * @param {integer} [radix] (Optional) An integer between 2 and 36 specifying
 *     the base to use for representing numeric values. Defaults to 16.
 * @return {string} The string representation of the ID.
 */
ItemId.prototype.toString = function () {
    return arguments.length < 1 ? stringify(this.low_, this.high_) : Long.prototype.toString.apply(this, arguments);
};

/**
 * Returns a 16 character long hexadecimal string representation of the ID.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
ItemId.prototype.valueOf = function () {
    return stringify(this.low_, this.high_);
};


// Public Functions ===========================================================

/**
 * Creates an ItemId with the specified date as timestamp (i.e. the number of
 * millisecs since midnight 1/1/1970) with the rest of the ItemId zeroed out.
 *
 * Often used for comparisons between, or while sorting, ItemIds.
 *
 * @param {object} date The date to initialize from.
 * @return {ItemId} An `ItemId` object instantiated with the specified
 *     date’s timestamp and the rest of the ID zeroed out.
 */
function createFromDate(date) {
    if (!(date instanceof Date)) {
        throw new Error('ItemId.createFromDate: expected a Date object.');
    }
    return createFromTime(date.getTime());
}

/**
 * Returns the `ItemId` representation of the specified `Long` object.
 *
 * @return {ItemId} The resulting `ItemId` object.
 */
function createFromLong(long) {
    if (!(long instanceof Long)) {
        throw new Error('ItemId.createFromLong: expected a Long object.');
    }
    return new ItemId(long.low_, long.high_);
}

/**
 * Creates an ItemId with the specified timestamp (i.e. the number of millisecs
 * since midnight 1/1/1970) with the rest of the ItemId zeroed out.
 *
 * Often used for comparisons between, or while sorting, ItemIds.
 *
 * @param {integer} timestamp an integer representing milliseconds since
 *     Unix epoch.
 * @return {ItemId} An `ItemId` object instantiated with the specified
 *     timestamp and the rest of the ID zeroed out.
 */
function createFromTime(timestamp) {
    if (typeof timestamp !== 'number' || timestamp < 0 || timestamp > 0xfffffffffff) {
        throw new Error('ItemId.createFromTime: expected an integer representing milliseconds since Unix epoch.');
    }
    // Adding 5 zeroes (20 bits) for the 12-bit counter value and 8-bit machine ID.
    return new ItemId(('00000000000' + timestamp.toString(16)).slice(-11) + '00000');
}

/**
 * Constructs and returns a new unique ID value (i.e. a 64-bit hexadecimal
 * string value.)
 *
 * @return {string} A new unique 16 character long hexadecimal string ID.
 */
function newId() {
    // Count to the next value, keeping it at 12 bits.
    ITEM_ID_counter = (ITEM_ID_counter + 1) & 0xfff;

    // Hex the 44-bit timestamp.
    return Date.now().toString(16) +
        // Hex the counter, ensuring that it is 12 bits long.
        ((ITEM_ID_counter > 0xff ? '' : (ITEM_ID_counter > 0xf ? '0' : '00')) + ITEM_ID_counter.toString(16)) +
        // Add the 8-bit machine ID.
        ITEM_ID_machine_id;
}

/**
 * Set the machine ID.
 *
 * @param {integer} [id] (Optional) The new machine ID. If `id` isn’t specified
 *     the machine’s hostname will be used as a base for the new ID.
 * @return {integer} The previous machine ID.
 */
function setMachineId(id) {
    var result = parseInt(ITEM_ID_machine_id, 16);

    // Use the current hostname as the default machine ID.
    id = (typeof id !== 'undefined') ? Number(id) : Number('0x' + crypto.createHash('md5').update(os.hostname()).digest('hex').slice(0, 2));
    if (Number.isNaN(id) || id < 0 || id > 0xff) {
        throw new Error('ItemId.setMachineId: expected an integer value between 0 and 255 as machine ID: ' + id);
    }

    // Convert it into a 2 nibble long string, i.e. 8 bits.
    ITEM_ID_machine_id = ('00' + id.toString(16)).slice(-2);

    // Return the previous machine ID.
    return result;
}

/**
 * Returns a 16 character long hexadecimal `ItemId` string representation of
 * the given `Long` object.
 *
 * @param {Long} long The `Long` object who’s ID to return.
 * @return {string} The hexadecimal string representation of the given
 *     `Long` object.
 */
function strFromLong(long) {
    if (!(long instanceof Long)) {
        throw new Error('ItemId.strFromLong: expected a MongoDB Long object.');
    }
    return stringify(long.low_, long.high_);
}

/**
 * Returns a 16 character long hexadecimal `ItemId` string representation of
 * the given 32-bit low and 32-bit high values.
 *
 * @param {integer} low The low 32 bits of the ID.
 * @param {integer} high The high 32 bits of the ID.
 */
function stringify(low, high) {
    return (high >= 0xfffffff ? high.toString(16) : (high >= 0 ? '0' + high.toString(16) : (high + 0x100000000).toString(16))) +
            (low >= 0xfffffff ? low.toString(16) : (low >= 0 ? '0' + low.toString(16) : (low + 0x100000000).toString(16)));
}

/**
 * Returns `true` or `false` depending on if the given ID has the correct
 * format of a 16 character long hexadecimal representation of an `ItemId`.
 *
 * @param {string} id The string to test.
 * @return {boolean} `true` if the given string matches the format of a 16
 *     character long hexadecimal representation of an `ItemId`, otherwise
 *    `false`.
 */
function test(id) {
    return ITEM_ID_regex.test(id);
}


// Static References ==========================================================

ItemId.createFromDate = createFromDate;
ItemId.createFromLong = createFromLong;
ItemId.createFromTime = createFromTime;
ItemId.newId = newId;
ItemId.setMachineId = setMachineId;
ItemId.strFromLong = strFromLong;
ItemId.test = test;


// Export Statements ==========================================================

module.exports = ItemId;


// Extending the BSON Long Type ===============================================

/**
 * Constructs a new `ItemId` object from the current `Long`.
 *
 * @return A new `ItemId` object instantiated with the given `Long` value.
 */
Long.prototype.newItemId = function () {
    return new ItemId(this.low_, this.high_);
};

/**
 * Returns a 16 character long hexadecimal string representation of the ID.
 * Mimics the `ItemId.valueOf()` function for a `Long` value.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
Long.prototype.strItemId = function () {
    return stringify(this.low_, this.high_);
};

/**
 * Overriding the Long-type’s `toJSON` function in order to return the ItemId’s
 * string representation. This will be called by e.g. Primus when encoding data
 * for transmission.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
Long.prototype.toJSON = function () {
    return this.strItemId();
};

/**
 * Overriding the Long-type’s `toString` function in order to return the
 * ItemId’s string representation. This will also be used by the `toJSON`
 * function which is in turn called by e.g. Primus when encoding data for
 * transmission.
 *
 * @param {integer} [radix] (Optional) An integer between 2 and 36 specifying
 *     the base to use for representing numeric values. Defaults to 16.
 * @return {string} The hexadecimal string representation of the ID.
 */
var oldLongToString = Long.prototype.toString;
Long.prototype.toString = function () {
    if (arguments.length < 1) {
        return stringify(this.low_, this.high_);
    }
    return oldLongToString.apply(this, arguments);
};


// Unit Startup Routines ======================================================

// The machine ID will be needed when creating new IDs.
setMachineId();
