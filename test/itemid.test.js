'use strict';

var should = require('chai').should();
var ItemId = require('../itemid');
var Long   = require('bson').Long;

describe('#constructor', function () {
    it('Verifies that an ItemId can be constructed from a string ID', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.getTimestamp().should.equal(1441832782709);
        id.getCounterValue().should.equal(3534);
        id.getMachineId().should.equal(61);
    });
});

describe('#compare', function () {
    it('Verifies that an ItemId is lexicographically equal to itself', function () {
        var id = new ItemId();
        id.compare(id).should.equal(0);
    });

    it('Verifies that an ItemId is not lexicographically equal to another', function () {
        var id1 = new ItemId();
        var id2 = new ItemId();
        id1.compare(id2).should.not.equal(0);
    });
});

describe('#createFromDate', function () {
    it('Verifies that an ItemId can be created from a Date object', function () {
        var dates = [new Date(), new Date(1441922517727), new Date(0), new Date(0xfffffffffff)];
        for (var ith in dates) {
            var id = ItemId.createFromDate(dates[ith]);
            id.getTimestamp().should.equal(dates[ith].getTime());
            id.getCounterValue().should.equal(0);
            id.getMachineId().should.equal(0);
       }
    });
});

describe('#createFromLong', function () {
    it('Verifies that an ItemId can be created from a MongoDB Long type', function () {
        var id1 = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id1.high_;
        l.low_ = id1.low_;
        var id2 = ItemId.createFromLong(l);
        id2.equal(id1).should.equal(true);
    });
});

describe('#createFromTime', function () {
    it('Verifies that an ItemId can be created from a timestamp', function () {
        var timestamps = [Date.now(), 1441922517727, 1441905752206, 1441905597489, 1441922437429, 0xfffffffffff];
        for (var ith in timestamps) {
            var id = ItemId.createFromTime(timestamps[ith]);
            id.getTimestamp().should.equal(timestamps[ith]);
            id.getCounterValue().should.equal(0);
            id.getMachineId().should.equal(0);
       }
    });
});

describe('#equal', function () {
    it('Verifies that an ItemId is equal to itself', function () {
        var id = new ItemId();
        id.equal(id).should.equal(true);
    });

    it('Verifies that an ItemId is not equal to another', function () {
        var id1 = new ItemId();
        var id2 = new ItemId();
        id1.equal(id2).should.equal(false);
    });
});

describe('#getCounterValue', function () {
    it('Verifies that an ItemId’s counter value can be extracted', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.getCounterValue().should.equal(3534);
    });
});

describe('#getDate', function () {
    it('Verifies that an ItemId’s date can be extracted', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.getDate().getTime().should.equal(1441832782709);
    });
});

describe('#getMachineId', function () {
    it('Verifies that an ItemId’s machine ID can be extracted', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.getMachineId().should.equal(0x3d);
    });
});

describe('#getTimestamp', function () {
    it('Verifies that an ItemId’s timestamp can be extracted', function () {
        var timestamp = Date.now();
        ItemId.createFromTime(timestamp).getTimestamp().should.equal(timestamp);
        ItemId.createFromTime(0).getTimestamp().should.equal(0);
        ItemId.createFromTime(0xfffffffffff).getTimestamp().should.equal(0xfffffffffff);
    });
});

describe('#newId', function () {
    it('Verifies that a correct new ItemId can be created', function () {
        var strId = ItemId.newId();
        ItemId.test(strId).should.equal(true);
        var id = new ItemId(strId);
        id.valueOf().should.equal(strId);
    });
});

describe('#setMachineId', function () {
    it('Verifies that ItemId machine ID can be set', function () {
        var originalMachineId = ItemId.setMachineId(0);
        new ItemId().getMachineId().should.equal(0);
        ItemId.setMachineId(42).should.equal(0);
        new ItemId().getMachineId().should.equal(42);
        ItemId.setMachineId(0xff).should.equal(42);
        new ItemId().getMachineId().should.equal(0xff);
        ItemId.setMachineId(originalMachineId).should.equal(0xff);
        new ItemId().getMachineId().should.equal(originalMachineId);
    });
});

describe('#strFromLong', function () {
    it('Verifies that a MongoDB Long type can be converted into a stringified ItemId', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        ItemId.strFromLong(l).should.equal(id.valueOf());
    });
});

describe('#test', function () {
    it('Verifies that a stringified ItemId can be verified', function () {
        ItemId.test('ffffffffffffffff').should.equal(true);
        ItemId.test('0000000000000000').should.equal(true);
        ItemId.test('14fb3ee4b75dce3d').should.equal(true);
        ItemId.test('4fb3ee4b75dce3d').should.equal(false); // Too few characters.
        ItemId.test('g4fb3ee4b75dce3').should.equal(false); // Not hexadecimal.
        ItemId.test('-4fb3ee4b75dce3').should.equal(false); // Not hexadecimal.
    });
});

describe('#toJSON', function () {
    it('Verifies that an ItemId can be converted to a hexadecimal string', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toJSON().should.equal('14fb3ee4b75dce3d');
    });
});

describe('#toMySQL', function () {
    it('Verifies that an ItemId can be converted to a MySQL casting string', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toMySQL().should.equal("CAST(X\'14fb3ee4b75dce3d\' AS UNSIGNED)");
    });
});

describe('#toPostgreSQL', function () {
    it('Verifies that an ItemId can be converted to a PostgreSQL casting string', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toPostgreSQL().should.equal("CAST(X\'14fb3ee4b75dce3d\' AS bigint)");
    });
});

describe('#toString', function () {
    it('Verifies that an ItemId will be converted to a hexadecimal string if no arguments are given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toString().should.equal('14fb3ee4b75dce3d');
    });

    it('Verifies that an ItemId will be converted to a binary string if a base of 2 is given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toString(2).should.equal('1010011111011001111101110010010110111010111011100111000111101');
    });

    it('Verifies that an ItemId will be converted to a 32 base string if an argument of 32 is given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.toString(32).should.equal('19upusirlrjht');
    });
});

describe('#valueOf', function () {
    it('Verifies that an ItemId can be converted to a hexadecimal string', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        id.valueOf().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.newItemId', function () {
    it('Verifies that MongoDB’s Long type’s `newItemId()` routine has been overridden', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.newItemId().equal(id).should.equal(true);
    });
});

describe('Long.strItemId', function () {
    it('Verifies that MongoDB’s Long type’s `strItemId()` routine has been overridden', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.strItemId().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.toJSON', function () {
    it('Verifies that MongoDB’s Long type’s `toJSON()` routine has been overridden', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.toJSON().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.toString -- Verifies that MongoDB’s Long type’s `toString()` routine has been overridden', function () {
    it('Verifies that MongoDB’s Long type will be converted to a hexadecimal string if no arguments are given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.toString().should.equal('14fb3ee4b75dce3d');
    });

    it('Verifies that MongoDB’s Long type will be converted to a binary string if a base of 2 is given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.toString(2).should.equal('1010011111011001111101110010010110111010111011100111000111101');
    });

    it('Verifies that MongoDB’s Long type will be converted to a 32 base string if an argument of 32 is given', function () {
        var id = new ItemId('14fb3ee4b75dce3d');
        var l = new Long();
        l.high_ = id.high_;
        l.low_ = id.low_;
        l.toString(32).should.equal('19upusirlrjht');
    });
});
