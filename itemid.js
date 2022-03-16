/**
 * Distributed site-unique 64-bit user IDs.
 *
 * @author Fredric Rylander, https://github.com/fredricrylander
 * @date 2014-01-31
 * @license MIT
 */

'use strict';

const util = require('util');
const os = require('os');
const crypto = require('crypto');
const Long = require('bson').Long;

// Private Constants ==========================================================

// Regex matching 16 character long hexadecimal strings.
const itemIdRegex = /^[\da-fA-F]{16}$/;

// Private Unit-global Variables ==============================================

// Initate the user ID counter with a random number.
let itemIdCounter = Math.round(Math.random() * 0xF_FF);

// Initiate the machine ID constant.
let itemIdMachineId = null;

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
 * Acceptable signatures are:
 * - ItemId()
 * - ItemId(string)
 * - ItemId(itemId)
 * - ItemId(low, high)
 *
 * @class ItemId
 * @param {string} [arg1] (Optional) string value to instantiate as an ItemId.
 *     The value is expected to be a 16 character long hexadecimal string,
 *     without any '0x'-prefix, or another ItemId instance.
 * @param {integer} [arg1] (Optional) The low 32-bits of the ID.
 * @param {integer} [arg2] (Optional) The high 32-bits of the ID.
 */
const ItemId = function (arg1, arg2) {
    // Make sure an object is used.
    if (!(this instanceof ItemId)) {
        return new ItemId(arg1, arg2);
    }

    let low = Number.NaN;
    let high = Number.NaN;

    // The constructor may have been called with an empty argument list, a
    // Long/ItemId, a hexadecimal string ID or two 32-bit values (representing
    // low/high parts of the 64-bit ID.)
    switch (arguments.length) {
        case 0: {
            const id = newId();
            low = Number.parseInt(id.slice(-8), 16); // Low 32 bits.
            high = Number.parseInt(id.slice(-16, -8), 16); // High 32 bits.
            break;
        }

        case 1: {
            // Return a clone if the first argument is another Long.
            if (Long.isLong(arg1)) {
                high = arg1.high;
                low = arg1.low;
            } else {
                const id = String(arg1);
                if (id.length === 16) {
                    low = Number.parseInt(id.slice(-8), 16); // Low 32 bits.
                    high = Number.parseInt(id.slice(-16, -8), 16); // High 32 bits.
                } else {
                    // Try to parse the argument as if it is a decimal string representation.
                    const long = Long.fromString(id, 10);
                    low = long.low;
                    high = long.high;
                }
            }

            break;
        }

        default: {
            // Assume the two given arguments are low/high parts of the 64-bit integer.
            low = arguments[0];
            high = arguments[1];
        }
    }

    // Complain if the incoming arguments were faulty.
    if (Number.isNaN(Number(low)) || Number.isNaN(Number(high))) {
        let message = 'ItemId: ';
        switch (arguments.length) {
            case 1:
                message += `expected a hexadecimal string of 64 bits: ${arguments[0]}`;
                break;

            case 2:
                message += `expected two 32-bit values, low: ${arguments[0]}, high: ${arguments[1]}`;
                break;

            default:
                message += `unexpected error when creating a new ID, high: ${high}, low: ${low}`;
        }

        throw new TypeError(message);
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
    const thisHi = this.high >= 0 ? this.high : this.high + 0x1_00_00_00_00;
    const thatHi = id.high >= 0 ? id.high : id.high + 0x1_00_00_00_00;

    if (thisHi === thatHi) {
        const thisLo = this.low >= 0 ? this.low : this.low + 0x1_00_00_00_00;
        const thatLo = id.low >= 0 ? id.low : id.low + 0x1_00_00_00_00;
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
    const data = {
        valueOf: this.valueOf(),
        high: this.high,
        low: this.low,
        getTimestamp: this.getTimestamp(),
        getCounter: this.getCounterValue(),
        getMachineId: this.getMachineId(),
        getDate: this.getDate(),
        toString: this.toString(),
        toMySQL: this.toMySQL(),
        toPostgreSQL: this.toPostgreSQL(),
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
    return this.high === id.high && this.low === id.low;
};

/**
 * Returns the current user ID’s counter value.
 *
 * @return {integer} The counter value from the current user ID.
 */
ItemId.prototype.getCounterValue = function () {
    return (this.getLowBitsUnsigned() >>> 8) & 0xF_FF;
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
    return this.getLowBitsUnsigned() & 0xFF;
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
    // var timestamp = (this.high << 12) | (this.low >>> 20);
    const high = this.high >= 0 ? this.high : this.high + 0x1_00_00_00_00;
    return Math.floor((high * 4096) + (this.getLowBitsUnsigned() / 1_048_576));
};

/**
 * Returns the JSON representation of the ID, effectively the same
 * as `valueOf()`.
 *
 * @return {string} The JSON representation of the ID.
 * @see valueOf
 */
ItemId.prototype.toJSON = function () {
    return stringify(this.low, this.high);
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
    return `CAST(X'${stringify(this.low, this.high)}' AS UNSIGNED)`;
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
    return `CAST(X'${stringify(this.low, this.high)}' AS bigint)`;
};

/**
 * Returns the string representation of the user ID.
 *
 * @param {integer} [radix] (Optional) An integer between 2 and 36 specifying
 *     the base to use for representing numeric values. Defaults to 16.
 * @return {string} The string representation of the ID.
 */
ItemId.prototype.toString = function () {
    return arguments.length === 0 ? stringify(this.low, this.high) : Reflect.apply(Long.prototype.toString, this, arguments);
};

/**
 * Returns a 16 character long hexadecimal string representation of the ID.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
ItemId.prototype.valueOf = function () {
    return stringify(this.low, this.high);
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
        throw new TypeError('ItemId.createFromDate: expected a Date object.');
    }

    return createFromTime(date.getTime());
}

/**
 * Returns the `ItemId` representation of the specified `Long` object.
 *
 * @property {object} long The Long object to base the new ItemId on.
 * @return {ItemId} The resulting `ItemId` object.
 */
function createFromLong(long) {
    if (
        !Object.prototype.hasOwnProperty.call(long, 'low')
        || !Object.prototype.hasOwnProperty.call(long, 'high')
    ) {
        throw new TypeError('ItemId.strFromLong: expected a MongoDB Long object.');
    }

    return new ItemId(long.low, long.high);
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
    if (typeof timestamp !== 'number') {
        throw new TypeError('ItemId.createFromTime: expected an integer representing milliseconds since Unix Epoch.');
    }

    if (timestamp < 0 || timestamp > 0xF_FF_FF_FF_FF_FF) {
        throw new RangeError('ItemId.createFromTime: expected an integer representing milliseconds since Unix Epoch.');
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
    itemIdCounter = (itemIdCounter + 1) & 0xF_FF;

    // Hex the 44-bit timestamp.
    return Date.now().toString(16)
        // Hex the counter, ensuring that it is 12 bits long.
        + ((itemIdCounter > 0xFF ? '' : (itemIdCounter > 0xF ? '0' : '00')) + itemIdCounter.toString(16))
        // Add the 8-bit machine ID.
        + itemIdMachineId;
}

/**
 * Set the machine ID.
 *
 * @param {integer} [id] (Optional) The new machine ID. If `id` isn’t specified
 *     the machine’s hostname will be used as a base for the new ID.
 * @return {integer} The previous machine ID.
 */
function setMachineId(id) {
    const result = Number.parseInt(itemIdMachineId, 16);

    // Use the current hostname as the default machine ID.
    id = (typeof id !== 'undefined') ? Number(id) : Number('0x' + crypto.createHash('md5').update(os.hostname()).digest('hex').slice(0, 2));
    if (Number.isNaN(id)) {
        throw new TypeError(`ItemId.setMachineId: expected an integer value between 0 and 255 as machine ID: ${id}`);
    }

    if (id < 0 || id > 0xFF) {
        throw new RangeError(`ItemId.setMachineId: expected an integer value between 0 and 255 as machine ID: ${id}`);
    }

    // Convert it into a 2 nibble long string, i.e. 8 bits.
    itemIdMachineId = ('00' + id.toString(16)).slice(-2);

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
function stringFromLong(long) {
    if (
        !Object.prototype.hasOwnProperty.call(long, 'low')
        || !Object.prototype.hasOwnProperty.call(long, 'high')
    ) {
        throw new TypeError('ItemId.strFromLong: expected a MongoDB Long object.');
    }

    return stringify(long.low, long.high);
}

/**
 * Returns a 16 character long hexadecimal `ItemId` string representation of
 * the given 32-bit low and 32-bit high values.
 *
 * @param {integer} low The low 32 bits of the ID.
 * @param {integer} high The high 32 bits of the ID.
 */
function stringify(low, high) {
    return (high >= 0xF_FF_FF_FF ? high.toString(16) : (high >= 0 ? ('00000000' + high.toString(16)).slice(-8) : (high + 0x1_00_00_00_00).toString(16)))
            + (low >= 0xF_FF_FF_FF ? low.toString(16) : (low >= 0 ? ('00000000' + low.toString(16)).slice(-8) : (low + 0x1_00_00_00_00).toString(16)));
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
    return itemIdRegex.test(id);
}

// Static References ==========================================================

ItemId.createFromDate = createFromDate;
ItemId.createFromLong = createFromLong;
ItemId.createFromTime = createFromTime;
ItemId.newId = newId;
ItemId.setMachineId = setMachineId;
ItemId.strFromLong = stringFromLong;
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
    return new ItemId(this.low, this.high);
};

/**
 * Returns a 16 character long hexadecimal string representation of the ID.
 * Mimics the `ItemId.valueOf()` function for a `Long` value.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
Long.prototype.strItemId = function () {
    return stringify(this.low, this.high);
};

/**
 * Overriding the Long-type’s `toJSON` function in order to return the ItemId’s
 * string representation. This will be called by e.g. Primus when encoding data
 * for transmission.
 *
 * @return {string} The hexadecimal string representation of the ID.
 */
Long.prototype.toJSON = function () {
    return stringify(this.low, this.high);
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
const oldLongToString = Long.prototype.toString;
Long.prototype.toString = function () {
    if (arguments.length === 0) {
        return stringify(this.low, this.high);
    }

    return Reflect.apply(oldLongToString, this, arguments);
};

// Unit Startup Routines ======================================================

// The machine ID will be needed when creating new IDs.
setMachineId();
