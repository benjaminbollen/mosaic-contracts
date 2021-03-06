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

const BN = require('bn.js');
const Utils = require('../../test_lib/utils.js');
const MetaBlockUtils = require('../../test_lib/meta_block.js');

const TestData = require('./helpers/data.js');

const AuxiliaryBlockStore = artifacts.require('AuxiliaryBlockStore');
const MockBlockStore = artifacts.require('MockBlockStore');

contract(
  'AuxiliaryBlockStore.auxiliaryTransitionHashAtBlock()',
  async (accounts) => {
    const coreIdentifier = '0x0000000000000000000000000000000000000002';
    const epochLength = new BN('3');
    const pollingPlaceAddress = accounts[0];
    let originBlockStore;
    const initialBlockHash = TestData.initialBlock.hash;
    const initialStateRoot = TestData.initialBlock.stateRoot;
    const initialGas = TestData.initialBlock.gas;
    const initialTransactionRoot = TestData.initialBlock.transactionRoot;
    const initialHeight = TestData.initialBlock.height;
    const initialKernelHash = TestData.initialBlock.kernelHash;

    let blockStore;

    beforeEach(async () => {
      originBlockStore = await MockBlockStore.new();

      blockStore = await AuxiliaryBlockStore.new(
        coreIdentifier,
        epochLength,
        pollingPlaceAddress,
        originBlockStore.address,
        initialBlockHash,
        initialStateRoot,
        initialHeight,
        initialGas,
        initialTransactionRoot,
        initialKernelHash,
      );
    });

    it(
      'should return auxiliary transition hash at given block Hash if'
        + ' checkpoint is defined',
      async () => {
        const originDynasty = await originBlockStore.getCurrentDynasty.call();
        const originBlockHash = await originBlockStore.getHead.call();

        const auxiliaryTransitionObject = {
          coreIdentifier,
          kernelHash: initialKernelHash,
          auxiliaryDynasty: 0,
          auxiliaryBlockHash: initialBlockHash,
          gas: initialGas,
          originDynasty,
          originBlockHash,
          transactionRoot: initialTransactionRoot,
        };

        const expectedTransitionHash = MetaBlockUtils.hashAuxiliaryTransition(
          auxiliaryTransitionObject,
        );

        const transitionHash = await blockStore.auxiliaryTransitionHashAtBlock.call(
          initialBlockHash,
        );

        assert.strictEqual(
          transitionHash,
          expectedTransitionHash,
          'Transition hash is different from expected transition hash.',
        );
      },
    );

    it('should fail if checkpoint is not defined at given block hash.', async () => {
      const wrongBlockHash = web3.utils.sha3('wrong block hash');

      await Utils.expectRevert(
        blockStore.auxiliaryTransitionHashAtBlock.call(wrongBlockHash),
        'Checkpoint not defined for given block hash.',
      );
    });
  },
);
