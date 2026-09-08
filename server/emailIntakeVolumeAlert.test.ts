import assert from 'node:assert/strict';
import {
  isVolumeThresholdExceeded,
  nextVolumeAlertState,
  volumeAlertSubject,
} from './emailIntakeVolumeAlert.js';

assert.equal(isVolumeThresholdExceeded(20), false);
assert.equal(isVolumeThresholdExceeded(21), true);
assert.match(volumeAlertSubject(21), /21/);

const firstCrossing = nextVolumeAlertState(21, { isAboveThreshold: false, alertClaimed: false });
assert.equal(firstCrossing.shouldSend, true);

const sustainedSpike = nextVolumeAlertState(22, firstCrossing);
assert.equal(sustainedSpike.shouldSend, false);

const recovered = nextVolumeAlertState(20, sustainedSpike);
assert.deepEqual(recovered, { isAboveThreshold: false, alertClaimed: false, shouldSend: false });

const secondCrossing = nextVolumeAlertState(21, recovered);
assert.equal(secondCrossing.shouldSend, true);

console.log('emailIntakeVolumeAlert fixture assertions passed');
process.exit(0);