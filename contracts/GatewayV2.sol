/* solhint-disable-next-line compiler-fixed */
pragma solidity ^0.4.23;

// Copyright 2018 OpenST Ltd.
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
// Value chain: Gateway
//
// http://www.simpletoken.org/
//
// ----------------------------------------------------------------------------

import "./ProtocolVersioned.sol";
import "./OpenSTValueInterface.sol";
import "./EIP20Interface.sol";
import "./Owned.sol";
import "./WorkersInterface.sol";
import "./OpenSTProtocol.sol";
import "./Hasher.sol";

/**
 *  @title Gateway contract which implements ProtocolVersioned, Owned.
 *
 *  @notice Gateway contract is staking Gateway that separates the concerns of staker and staking processor.
 *          Stake process is executed through Gateway contract rather than directly with the protocol contract.
 *          The Gateway contract will serve the role of staking account rather than an external account.
 */
contract Gateway is ProtocolVersioned, Owned, Hasher {

    /** Events */

    /** Below event is emitted after successful execution of requestStake */
    event StakeRequested(address _staker, uint256 _nonce, uint256 _amount, address _beneficiary);
    /** Below event is emitted after successful execution of revertStakeRequest */
    event StakeRequestReverted(address _staker, uint256 _amount);
    /** Below event is emitted after successful execution of rejectStakeRequest */
    event StakeRequestRejected(address _staker, uint256 _amount, uint8 _reason);
    /** Below event is emitted after successful execution of acceptStakeRequest */
    event StakeRequestAccepted(
        address _staker,
        uint256 _amountST,
        uint256 _amountUT,
        uint256 _nonce,
        uint256 _unlockHeight,
        bytes32 _stakingIntentHash);
    /** Below event is emitted after successful execution of setWorkers */
    event WorkersSet(WorkersInterface _workers);

    /** Storage */

    /** Storing stake requests */
    mapping(address /*staker */ => StakeRequest) public stakeRequests;
    /** Storing workers contract address */
    WorkersInterface public workers;
    /** Storing bounty amount that will be used while accepting stake */
    uint256 public bounty;
    /** Storing utility token UUID */
    bytes32 public uuid;
    address stakeAddress;

    OpenSTProtocol.ProtocolStorage protocolStorage;

    /** Structures */

    struct StakeRequest {
        uint256 amount;
        address beneficiary;
    }

    /** Public functions */

    /**
     *  @notice Contract constructor.
     *
     *  @param _workers Workers contract address.
     *  @param _bounty Bounty amount that worker address stakes while accepting stake request.
     *  @param _uuid UUID of utility token.
     *  @param _openSTProtocol OpenSTProtocol address contract that governs staking.
     */
    constructor(
        WorkersInterface _workers,
        uint256 _bounty,
        bytes32 _uuid,
        address _openSTProtocol)
    public
    Owned()
    ProtocolVersioned(_openSTProtocol)
    {
        require(_workers != address(0));
        require(_uuid.length != uint8(0));

        workers = _workers;
        bounty = _bounty;
        uuid = _uuid;

    }

    /**
     *  @notice External function requestStake.
     *
     *  @dev In order to request stake the staker needs to approve Gateway contract for stake amount.
     *       Staked amount is transferred from staker address to Gateway contract.
     *
     *  @param _amount Staking amount.
     *  @param _beneficiary Beneficiary address.
     *
     *  @return bool Specifies status of the execution.
     */
    function requestStake(
        uint256 _amount,
        uint256 _nonce,
        address _beneficiary
    )
    external
    returns (bool /* success */)
    {
        require(_amount > uint256(0));
        require(_beneficiary != address(0));
        bytes32 requestHash = OpenSTProtocol.request(protocolStorage, _nonce);
        // check if the stake request does not exists
        require(stakeRequests[requestHash].beneficiary == address(0));

        require(OpenSTValueInterface(openSTProtocol).valueToken().transferFrom(msg.sender, address(this), _amount));

        emit StakeRequested(msg.sender, _nonce, _amount, _beneficiary);

        return true;
    }

    /**
     *  @notice External function to accept requested stake.
     *
     *  @dev This can be called only by whitelisted worker address.
     *       Bounty amount is transferred from msg.sender to Gateway contract.
     *       openSTProtocol is approved for staking amount by Gateway contract.
     *
     *  @param _staker Staker address.
     *  @param _hashLock Hash lock.
     *
     *  @return amountUT Branded token amount.
     *  @return nonce Staker nonce count.
     *  @return unlockHeight Height till what the amount is locked.
     *  @return stakingIntentHash Staking intent hash.
     */
    function acceptStakeRequest(address _staker, bytes32 _nonce, bytes32 _hashLock)
    external
    returns (
        uint256 amountUT,
        uint256 nonce,
        uint256 unlockHeight,
        bytes32 stakingIntentHash)
    {
        // check if the caller is whitelisted worker
        require(workers.isWorker(msg.sender));
        bytes32 requestHash = keccak256(abi.encodePacked(_staker, _nonce));

        StakeRequest storage stakeRequest = stakeRequests[_staker];

        // check if the stake request exists
        require(stakeRequest.beneficiary != address(0));

        // check if _hashLock is not 0
        require(_hashLock != bytes32(0));

        // Transfer bounty amount from worker to Gateway contract
        require(OpenSTValueInterface(openSTProtocol).valueToken().transferFrom(msg.sender, address(this), bounty));

        unlockHeight = block.number + blocksToWaitLong;

        bytes32 stakingIntentHash = OpenSTProtocol.declareIntent(protocolStorage, requestHash, _hashLock);

        stakes[stakingIntentHash] = Stake({
            uuid : _uuid,
            staker : _staker,
            beneficiary : _beneficiary,
            nonce : _nonce,
            amount : stakeRequest.amount,
            unlockHeight : unlockHeight,
            hashLock : _hashLock
            });

        stakeRequests[_staker].unlockHeight = unlockHeight;
        stakeRequests[_staker].hashLock = _hashLock;

        emit StakeRequestAccepted(_staker, stakeRequest.amount, amountUT, nonce, unlockHeight, stakingIntentHash);

        return (amountUT, nonce, unlockHeight, stakingIntentHash);
    }


    /**
     *  @notice External function to process staking.
     *
     *  @dev Bounty amount is transferred to msg.sender if msg.sender is not a whitelisted worker.
     *       Bounty amount is transferred to workers contract if msg.sender is a whitelisted worker.
     *
     *  @param _stakingIntentHash Staking intent hash.
     *  @param _unlockSecret Unlock secret.
     *
     *  @return stakeRequestAmount Stake amount.
     */
    //todo how to verify if stake request is accepted
    function processStaking(
        bytes32 _stakingIntentHash,
        bytes32 _unlockSecret)
    external
    returns (uint256 stakeRequestAmount)
    {
        require(_stakingIntentHash != bytes32(0));

        address staker;
        bytes32 requestHash;
        (staker, requestHash) = OpenSTProtocol.declareIntent(protocolStorage, _stakingIntentHash, _unlockSecret);

        StakeRequest stakeRequest = stakeRequests[requestHash];
        require(stakeRequest.amount != 0);

        // check if the stake address is not 0
        require(stakerAddress != address(0));

        require(ERC20Interface(brandedToken).transfer(stakerAddress, stake.amount));

        //If the msg.sender is whitelited worker then transfer the bounty amount to Workers contract
        //else transfer the bounty to msg.sender.
        if (workers.isWorker(msg.sender)) {
            // Transfer bounty amount to the workers contract address
            require(ERC20Interface(brandedToken).transfer(workers, bounty));
        } else {
            //Transfer bounty amount to the msg.sender account
            require(ERC20Interface(brandedToken).transfer(msg.sender, bounty));
        }
        stakeRequestAmount = stakeRequest.amount;
        // delete the stake request from the mapping storage
        delete stakeRequests[requestHash];

        return stakeRequestAmount;
    }


}