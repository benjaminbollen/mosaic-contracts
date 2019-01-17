// Copyright 2019 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ----------------------------------------------------------------------------
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

const CoGateway = artifacts.require("TestEIP20CoGateway");
const BN = require('bn.js');
const web3 = require('../../test_lib/web3.js');

contract('EIP20CoGateway.penalty() ', function (accounts) {

  let coGateway, messageHash;

  let setup = async function(bounty) {
    coGateway = await CoGateway.new(
      accounts[0],
      accounts[1],
      accounts[2],
      bounty,
      accounts[3],
      accounts[4],
      accounts[5],
    );

    messageHash = web3.utils.sha3("message_hash");

    await coGateway.setRedeem(
      messageHash,
      accounts[6],
      new BN(10000),
    );

  };

  it('should return zero penalty when bounty amount it zero', async function () {

    let bounty = new BN(0);

    await setup(bounty);

    let penalty = await coGateway.penalty(messageHash);

    assert.strictEqual(
      penalty.eqn(0),
      true,
      `Penalty ${penalty.toString(10)} must be equal to 0`,
    );

  });

  it('penalty should be 1.5 times bounty amount', async function () {

    let bounty = new BN(100);

    await setup(bounty);

    let penalty = await coGateway.penalty(messageHash);

    assert.strictEqual(
      penalty.eq(bounty.muln(1.5)),
      true,
      `Penalty ${penalty.toString(10)} must be equal to ${bounty.muln(1.5).toString(10)}`,
    );

  });

  it('should return zero penalty for unknown message hash', async function () {

    let bounty = new BN(100);

    await setup(bounty);

    let penalty = await coGateway.penalty(web3.utils.sha3("random_hash"));

    assert.strictEqual(
      penalty.eqn(0),
      true,
      `Penalty ${penalty.toString(10)} must be equal to 0`,
    );

  });

  it('should return correct penalty amount for message hash when bounty ' +
    'amount is changed', async function () {

    let bounty = new BN(100);
    let changedBounty = new BN(500);

    await setup(bounty);

    // Change the bounty amount.
    await coGateway.setBounty(changedBounty);

    let penalty = await coGateway.penalty(messageHash);

    assert.strictEqual(
      penalty.eq(bounty.muln(1.5)),
      true,
      `Penalty ${penalty.toString(10)} must be equal to ${bounty.muln(1.5).toString(10)}`,
    );

    // Set the new message hash after the bounty change.
    messageHash = web3.utils.sha3("message_hash_1");

    await coGateway.setRedeem(
      messageHash,
      accounts[6],
      new BN(10000),
    );

    penalty = await coGateway.penalty(messageHash);

    assert.strictEqual(
      penalty.eq(changedBounty.muln(1.5)),
      true,
      `Penalty ${penalty.toString(10)} must be equal to ${bounty.muln(1.5).toString(10)}`,
    );

  });

});
