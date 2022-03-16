'use strict';

const chai = require('chai');
const ItemId = require('../itemid');
const Long = require('bson').Long;

chai.should();

describe('#constructor', () => {
    it('Verifies that an ItemId can be constructed from a string ID', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.getTimestamp().should.equal(1_441_832_782_709);
        id.getCounterValue().should.equal(3534);
        id.getMachineId().should.equal(61);
    });
    it('Verifies that an ItemId can be constructed from a decimal string representation', () => {
        const id = new ItemId('1511871251962777149');
        id.getTimestamp().should.equal(1_441_832_782_709);
        id.getCounterValue().should.equal(3534);
        id.getMachineId().should.equal(61);
    });
    it('Verifies that an ItemId can be constructed from a another ItemId', () => {
        const id1 = new ItemId('1511871251962777149');
        const id2 = new ItemId(id1);
        id2.getTimestamp().should.equal(1_441_832_782_709);
        id2.getCounterValue().should.equal(3534);
        id2.getMachineId().should.equal(61);
    });
    it('Verifies that the ItemId constructor throws an Error on bad input', () => {
        for (const ith of [
            ['not a number', 0],
            [0, 'not a number'],
        ]) {
            (function () {
                const id = new ItemId(ith[0], ith[1]);
                console.log('id:', id.toJSON());
            }).should.Throw(Error);
        }
    });
});

describe('#compare', () => {
    it('Verifies that an ItemId is lexicographically equal to itself', () => {
        const id = new ItemId();
        id.compare(id).should.equal(0);
    });

    it('Verifies that an ItemId is not lexicographically equal to another', () => {
        const id1 = new ItemId();
        const id2 = new ItemId();
        id1.compare(id2).should.not.equal(0);
    });
});

describe('#createFromDate', () => {
    it('Verifies that an ItemId can be created from a Date object', () => {
        const dates = [new Date(), new Date(1_441_922_517_727), new Date(0), new Date(0xF_FF_FF_FF_FF_FF), new Date('2015-10-20')];
        for (const ith in dates) {
            const id = ItemId.createFromDate(dates[ith]);
            id.getTimestamp().should.equal(dates[ith].getTime());
            id.getCounterValue().should.equal(0);
            id.getMachineId().should.equal(0);
        }
    });
    it('Verifies that createFromDate expects a Date object', () => {
        (function () {
            ItemId.createFromDate(new Object());
        }).should.Throw(Error);
    });
});

describe('#createFromLong', () => {
    it('Verifies that an ItemId can be created from a MongoDB Long type', () => {
        const id1 = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id1.high;
        l.low = id1.low;
        const id2 = ItemId.createFromLong(l);
        id2.equal(id1).should.equal(true);
    });
    it('Verifies that createFromLong expects a MongoDB Long type', () => {
        const id1 = new ItemId('14fb3ee4b75dce3d');
        let l = new Long();
        l.high = id1.high;
        l.low = id1.low;
        delete l.high;
        (function () {
            ItemId.createFromLong(l);
        }).should.Throw(Error);
        l = new Long();
        l.high = id1.high;
        l.low = id1.low;
        delete l.low;
        (function () {
            ItemId.createFromLong(l);
        }).should.Throw(Error);
    });
});

describe('#createFromTime', () => {
    it('Verifies that an ItemId can be created from a timestamp', () => {
        const timestamps = [Date.now(), 1_441_922_517_727, 1_441_905_752_206, 1_441_905_597_489, 1_441_922_437_429, 0xF_FF_FF_FF_FF_FF];
        for (const ith in timestamps) {
            const id = ItemId.createFromTime(timestamps[ith]);
            id.getTimestamp().should.equal(timestamps[ith]);
            id.getCounterValue().should.equal(0);
            id.getMachineId().should.equal(0);
        }
    });
    it('Verifies that createFromTime expects a timestamp', () => {
        for (const ith of [-1, (0xF_FF_FF_FF_FF_FF + 1), '1441922517727']) {
            (function () {
                ItemId.createFromTime(ith);
            }).should.Throw(Error);
        }
    });
});

describe('#equal', () => {
    it('Verifies that an ItemId is equal to itself', () => {
        const id = new ItemId();
        id.equal(id).should.equal(true);
    });

    it('Verifies that an ItemId is not equal to another', () => {
        const id1 = new ItemId();
        const id2 = new ItemId();
        id1.equal(id2).should.equal(false);
    });
});

describe('#getCounterValue', () => {
    it('Verifies that an ItemId’s counter value can be extracted', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.getCounterValue().should.equal(3534);
    });
});

describe('#getDate', () => {
    it('Verifies that an ItemId’s date can be extracted', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.getDate().getTime().should.equal(1_441_832_782_709);
    });
});

describe('#getMachineId', () => {
    it('Verifies that an ItemId’s machine ID can be extracted', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.getMachineId().should.equal(0x3D);
    });
});

describe('#getTimestamp', () => {
    it('Verifies that an ItemId’s timestamp can be extracted', () => {
        const timestamp = Date.now();
        ItemId.createFromTime(timestamp).getTimestamp().should.equal(timestamp);
        ItemId.createFromTime(0).getTimestamp().should.equal(0);
        ItemId.createFromTime(0xF_FF_FF_FF_FF_FF).getTimestamp().should.equal(0xF_FF_FF_FF_FF_FF);
    });
});

describe('#newId', () => {
    it('Verifies that a correct new ItemId can be created', () => {
        const stringId = ItemId.newId();
        ItemId.test(stringId).should.equal(true);
        const id = new ItemId(stringId);
        id.valueOf().should.equal(stringId);
    });
});

describe('#setMachineId', () => {
    it('Verifies that ItemId machine ID can be set', () => {
        const originalMachineId = ItemId.setMachineId(0);
        new ItemId().getMachineId().should.equal(0);
        ItemId.setMachineId(42).should.equal(0);
        new ItemId().getMachineId().should.equal(42);
        ItemId.setMachineId(0xFF).should.equal(42);
        new ItemId().getMachineId().should.equal(0xFF);
        ItemId.setMachineId(originalMachineId).should.equal(0xFF);
        new ItemId().getMachineId().should.equal(originalMachineId);
    });
    it('Verifies that setMachineId expects a number', () => {
        for (const ith of [{first: 0x3D}, 'not a number', Number.NaN, -1, (0xFF + 1)]) {
            (function () {
                ItemId.setMachineId(ith);
            }).should.Throw(Error);
        }
    });
});

describe('#strFromLong', () => {
    it('Verifies that a MongoDB Long type can be converted into a stringified ItemId', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        ItemId.strFromLong(l).should.equal(id.valueOf());
    });
    it('Verifies that strFromLong expects a MongoDB Long type', () => {
        const id1 = new ItemId('14fb3ee4b75dce3d');
        let l = new Long();
        l.high = id1.high;
        l.low = id1.low;
        delete l.high;
        (function () {
            ItemId.createFromLong(l);
        }).should.Throw(Error);
        l = new Long();
        l.high = id1.high;
        l.low = id1.low;
        delete l.low;
        (function () {
            ItemId.createFromLong(l);
        }).should.Throw(Error);
    });
});

describe('#test', () => {
    it('Verifies that a stringified ItemId can be verified', () => {
        ItemId.test('ffffffffffffffff').should.equal(true);
        ItemId.test('0000000000000000').should.equal(true);
        ItemId.test('14fb3ee4b75dce3d').should.equal(true);
        ItemId.test('4fb3ee4b75dce3d').should.equal(false); // Too few characters.
        ItemId.test('g4fb3ee4b75dce3').should.equal(false); // Not hexadecimal.
        ItemId.test('-4fb3ee4b75dce3').should.equal(false); // Not hexadecimal.
    });
});

describe('#toJSON', () => {
    it('Verifies that an ItemId can be converted to a hexadecimal string', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toJSON().should.equal('14fb3ee4b75dce3d');

        // Date that has a `low` value of 0.
        ItemId.createFromDate(new Date('2015-10-20')).toJSON().should.equal('150828ba00000000');

        // Should return a string of 16 zeros.
        id.high = 0;
        id.low = 0;
        id.toJSON().should.equal('0000000000000000');
    });
});

describe('#toMySQL', () => {
    it('Verifies that an ItemId can be converted to a MySQL casting string', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toMySQL().should.equal('CAST(X\'14fb3ee4b75dce3d\' AS UNSIGNED)');
    });
});

describe('#toPostgreSQL', () => {
    it('Verifies that an ItemId can be converted to a PostgreSQL casting string', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toPostgreSQL().should.equal('CAST(X\'14fb3ee4b75dce3d\' AS bigint)');
    });
});

describe('#toString', () => {
    it('Verifies that an ItemId will be converted to a hexadecimal string if no arguments are given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toString().should.equal('14fb3ee4b75dce3d');
    });

    it('Verifies that an ItemId will be converted to a binary string if a base of 2 is given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toString(2).should.equal('1010011111011001111101110010010110111010111011100111000111101');
    });

    it('Verifies that an ItemId will be converted to a 32 base string if an argument of 32 is given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.toString(32).should.equal('19upusirlrjht');
    });
});

describe('#valueOf', () => {
    it('Verifies that an ItemId can be converted to a hexadecimal string', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        id.valueOf().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.newItemId', () => {
    it('Verifies that MongoDB’s Long type’s `newItemId()` routine has been overridden', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.newItemId().equal(id).should.equal(true);
    });
});

describe('Long.strItemId', () => {
    it('Verifies that MongoDB’s Long type’s `strItemId()` routine has been overridden', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.strItemId().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.toJSON', () => {
    it('Verifies that MongoDB’s Long type’s `toJSON()` routine has been overridden', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.toJSON().should.equal('14fb3ee4b75dce3d');
    });
});

describe('Long.toString -- Verifies that MongoDB’s Long type’s `toString()` routine has been overridden', () => {
    it('Verifies that MongoDB’s Long type will be converted to a hexadecimal string if no arguments are given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.toString().should.equal('14fb3ee4b75dce3d');
    });

    it('Verifies that MongoDB’s Long type will be converted to a binary string if a base of 2 is given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.toString(2).should.equal('1010011111011001111101110010010110111010111011100111000111101');
    });

    it('Verifies that MongoDB’s Long type will be converted to a 32 base string if an argument of 32 is given', () => {
        const id = new ItemId('14fb3ee4b75dce3d');
        const l = new Long();
        l.high = id.high;
        l.low = id.low;
        l.toString(32).should.equal('19upusirlrjht');
    });
});
