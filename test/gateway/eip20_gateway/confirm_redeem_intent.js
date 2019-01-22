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

const EIP20Gateway = artifacts.require('TestEIP20Gateway.sol'),
  Token = artifacts.require("MockUtilityToken"),
  Utils = require('../../test_lib/utils'),
  MockToken = artifacts.require("MockToken"),
  BN = require('bn.js'),
  TestDataJSON = require('./test_data/redeem_progressed_1'),
  TestDataJSON2 = require('./test_data/redeem_progressed_2'),
  messageBus = require('../../test_lib/message_bus.js'),
  MockOrganization = artifacts.require('MockOrganization.sol'),
  EventDecoder = require('../../test_lib/event_decoder.js');

let MessageStatusEnum = messageBus.MessageStatusEnum;

contract('EIP20Gateway.confirmRedeemIntent() ', function (accounts) {

  let utilityToken,
    bountyAmount,
    coreAddress,
    owner,
    burnerAddress,
    dummyStateRootProvider,
    eip20Gateway,
    mockToken,
    baseToken,
    mockOrganization,
    worker,
    redeemRequest,
    redeemRequestWithNonceTwo,
    messageHash = TestDataJSON.gateway.confirm_redeem_intent.return_value.returned_value.messageHash_;

  async function confirmRedeemIntent(stubData) {

    await eip20Gateway.confirmRedeemIntent(
      stubData.redeemer,
      stubData.nonce,
      stubData.beneficiary,
      stubData.amount,
      stubData.gasPrice,
      stubData.gasLimit,
      stubData.blockNumber,
      stubData.hashLock,
      stubData.storageProof,
    );
  }

  beforeEach(async function () {

      mockToken = await MockToken.new({from: accounts[0]});
      baseToken = await MockToken.new({from: accounts[0]});

      redeemRequest = TestDataJSON.gateway.confirm_redeem_intent.params;
      redeemRequest.nonce = new BN(redeemRequest.nonce, 16);
      redeemRequest.amount = new BN(redeemRequest.amount, 16);
      redeemRequest.gasLimit = new BN(redeemRequest.gasLimit, 16);
      redeemRequest.blockNumber = new BN(redeemRequest.blockNumber, 16);
      redeemRequest.gasPrice = new BN(redeemRequest.gasPrice, 16);

      redeemRequestWithNonceTwo = TestDataJSON2.gateway.confirm_redeem_intent.params;
      redeemRequestWithNonceTwo.nonce = new BN(redeemRequestWithNonceTwo.nonce, 16);
      redeemRequestWithNonceTwo.amount = new BN(redeemRequestWithNonceTwo.amount, 16);
      redeemRequestWithNonceTwo.gasLimit = new BN(redeemRequestWithNonceTwo.gasLimit, 16);
      redeemRequestWithNonceTwo.blockNumber = new BN(redeemRequestWithNonceTwo.blockNumber, 16);
      redeemRequestWithNonceTwo.gasPrice = new BN(redeemRequestWithNonceTwo.gasPrice, 16);

      owner = accounts[4];
      worker = accounts[8];

      mockOrganization = await MockOrganization.new(owner, worker);

      let symbol = "OST",
        name = "Simple Token",
        decimals = 18;

      utilityToken = await Token.new(
        accounts[3],
        symbol,
        name,
        decimals,
        owner,
        {from: accounts[0]},
      );

      coreAddress = accounts[3];
      burnerAddress = accounts[6];
      bountyAmount = new BN(100);
      dummyStateRootProvider = accounts[2];

      eip20Gateway = await EIP20Gateway.new(
        mockToken.address,
        baseToken.address,
        dummyStateRootProvider,
        bountyAmount,
        mockOrganization.address,
        burnerAddress,
      );

      await eip20Gateway.activateGateway(TestDataJSON.contracts.coGateway, {from: owner});
      await eip20Gateway.setStorageRoot(
        redeemRequest.blockNumber,
        redeemRequest.storageRoot,
      );

    }
  );

  it('should pass when all the params are valid', async function () {

      await confirmRedeemIntent(redeemRequest);

    }
  );

  it('should return correct param', async function () {

    let result = await eip20Gateway.confirmRedeemIntent.call(
      redeemRequest.redeemer,
      redeemRequest.nonce,
      redeemRequest.beneficiary,
      redeemRequest.amount,
      redeemRequest.gasPrice,
      redeemRequest.gasLimit,
      redeemRequest.blockNumber,
      redeemRequest.hashLock,
      redeemRequest.storageProof,
    );

    messageHash = TestDataJSON.gateway.confirm_redeem_intent.return_value.returned_value.messageHash_;
    assert.strictEqual(
      result,
      messageHash,
      `Message hash from event must be equal to ${messageHash}.`,
    );

  });

  it('should emit `RedeemIntentConfirmed` event.', async function () {

    let tx = await eip20Gateway.confirmRedeemIntent(
      redeemRequest.redeemer,
      redeemRequest.nonce,
      redeemRequest.beneficiary,
      redeemRequest.amount,
      redeemRequest.gasPrice,
      redeemRequest.gasLimit,
      redeemRequest.blockNumber,
      redeemRequest.hashLock,
      redeemRequest.storageProof,
    );

    let event = EventDecoder.getEvents(tx, eip20Gateway);

    assert.isDefined(
      event.RedeemIntentConfirmed,
      'Event RedeemIntentConfirmed must be emitted.',
    );

    let eventData = event.RedeemIntentConfirmed;

    let params = TestDataJSON.gateway.confirm_redeem_intent.params;

    assert.strictEqual(
      eventData._messageHash,
      messageHash,
      `Message hash from event must be equal to ${messageHash}.`,
    );

    assert.strictEqual(
      eventData._redeemer,
      params.redeemer,
      `Redeemer address ${eventData._redeemer} from event must be equal to ${params.redeemer}.`,
    );

    let nonce = new BN(params.nonce, 16);
    assert.strictEqual(
      nonce.eq(eventData._redeemerNonce),
      true,
      `Nonce value ${eventData._redeemerNonce} from event must be equal to ${nonce.toString(10)}.`,
    );

    assert.strictEqual(
      eventData._beneficiary,
      params.beneficiary,
      `Beneficiary address from event must be equal to ${params.beneficiary}.`,
    );

    let amount = new BN(params.amount, 16);
    assert.strictEqual(
      amount.eq(eventData._amount),
      true,
      `Amount ${eventData._amount} from event must be equal to ${amount.toString(10)}.`,
    );

    let blockHeight = new BN(params.blockNumber, 16);
    assert.strictEqual(
      blockHeight.eq(eventData._blockHeight),
      true,
      `Block height ${eventData._blockHeight} from event must be equal to ${blockHeight.toString(10)}.`,
    );

    assert.strictEqual(
      eventData._hashLock,
      params.hashLock,
      `Hash lock from event must be equal to ${params.hashLock}.`,
    );

  });

  it('should confirm new redeem intent if status of previous ' +
    'confirmed redeem message is revoked', async function () {

      await eip20Gateway.confirmRedeemIntent(
        redeemRequest.redeemer,
        redeemRequest.nonce,
        redeemRequest.beneficiary,
        redeemRequest.amount,
        redeemRequest.gasPrice,
        redeemRequest.gasLimit,
        redeemRequest.blockNumber,
        redeemRequest.hashLock,
        redeemRequest.storageProof,
      );

      await eip20Gateway.setInboxStatus(
        TestDataJSON.gateway.confirm_redeem_intent.return_value.returned_value.messageHash_,
        MessageStatusEnum.Revoked,
      );

      await eip20Gateway.setStorageRoot(
        redeemRequestWithNonceTwo.blockNumber,
        redeemRequestWithNonceTwo.storageRoot,
      );

      await confirmRedeemIntent(redeemRequestWithNonceTwo);
    }
  );

  it('should confirm new redeem intent if status of previous ' +
    'confirmed redeem intent is progressed', async function () {

      await eip20Gateway.confirmRedeemIntent(
        redeemRequest.redeemer,
        redeemRequest.nonce,
        redeemRequest.beneficiary,
        redeemRequest.amount,
        redeemRequest.gasPrice,
        redeemRequest.gasLimit,
        redeemRequest.blockNumber,
        redeemRequest.hashLock,
        redeemRequest.storageProof,
      );

      await eip20Gateway.setInboxStatus(
        TestDataJSON.gateway.confirm_redeem_intent.return_value.returned_value.messageHash_,
        MessageStatusEnum.Progressed,
      );

      await eip20Gateway.setStorageRoot(
        redeemRequestWithNonceTwo.blockNumber,
        redeemRequestWithNonceTwo.storageRoot
      );

      await confirmRedeemIntent(redeemRequestWithNonceTwo);
    }
  );

  it('should fail when redeemer address is zero', async function () {

      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          Utils.NULL_ADDRESS,
          redeemRequest.nonce,
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Redeemer address must not be zero"
      );

    }
  );

  it('should fail when beneficiary address is zero', async function () {

      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce,
          Utils.NULL_ADDRESS,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Beneficiary address must not be zero.",
      );

    }
  );

  it('should fail when amount is zero', async function () {

      let amount = new BN(0);
      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce,
          redeemRequest.beneficiary,
          amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Redeem amount must not be zero.",
      );

    }
  );

  it('should fail when rlp of parent nodes is zero', async function () {

    let rlpParentNodes = "0x";
    await Utils.expectRevert(
      eip20Gateway.confirmRedeemIntent(
        redeemRequest.redeemer,
        redeemRequest.nonce,
        redeemRequest.beneficiary,
        redeemRequest.amount,
        redeemRequest.gasPrice,
        redeemRequest.gasLimit,
        redeemRequest.blockNumber,
        redeemRequest.hashLock,
        rlpParentNodes,
      ),
      "RLP encoded parent nodes must not be zero.",
    );

  });

  it('should fail when redeemer nonce is already consumed', async function () {

      let redeemerNonce = new BN(0);
      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemerNonce,
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Invalid nonce.",
      );
    }
  );

  it('should fail when storage root for the block height is not available',
    async function () {

      let blockHeight = new BN(1);
      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce,
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          blockHeight,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Storage root must not be zero.",
      );
    });

  it('should fail when the rlp parent nodes is incorrect',
    async function () {

      let rlpParentNodes = TestDataJSON2.gateway.confirm_redeem_intent.params.storageProof;

      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce,
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          rlpParentNodes,
        ),
        "Merkle proof verification failed.",
      );

    }
  );

  it('should fail to confirm redeem intent if its already confirmed once',
    async function () {

      await eip20Gateway.confirmRedeemIntent(
        redeemRequest.redeemer,
        redeemRequest.nonce,
        redeemRequest.beneficiary,
        redeemRequest.amount,
        redeemRequest.gasPrice,
        redeemRequest.gasLimit,
        redeemRequest.blockNumber,
        redeemRequest.hashLock,
        redeemRequest.storageProof,
      );

      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce,
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Invalid nonce.",
      );
    }
  );

  it('should fail to confirm new redeem intent if status of previous ' +
    'confirmed redeem intent is declared', async function () {

      await eip20Gateway.confirmRedeemIntent(
        redeemRequest.redeemer,
        redeemRequest.nonce,
        redeemRequest.beneficiary,
        redeemRequest.amount,
        redeemRequest.gasPrice,
        redeemRequest.gasLimit,
        redeemRequest.blockNumber,
        redeemRequest.hashLock,
        redeemRequest.storageProof,
      );

      await Utils.expectRevert(
        eip20Gateway.confirmRedeemIntent(
          redeemRequest.redeemer,
          redeemRequest.nonce.addn(1),
          redeemRequest.beneficiary,
          redeemRequest.amount,
          redeemRequest.gasPrice,
          redeemRequest.gasLimit,
          redeemRequest.blockNumber,
          redeemRequest.hashLock,
          redeemRequest.storageProof,
        ),
        "Previous process is not completed.",
      );
    }
  );

});
