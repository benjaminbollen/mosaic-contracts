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

/** @title Configuration constants for the AuxiliaryCore contract. */
contract AuxiliaryCoreConfig {

    /** The number of decimals of the base token. */
    uint256 public constant DECIMALS_FACTOR = 10 ** uint256(18);

    /**
     * The cost in base tokens that it costs a validator to report a state
     * root.
     */
    uint256 public constant COST_REPORT_STATE_ROOT = 1 * DECIMALS_FACTOR;
}