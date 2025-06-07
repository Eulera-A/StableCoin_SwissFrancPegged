// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

//import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

interface IProxyAdmin {
    //function upgrade(address proxy, address implementation) external;
    function upgradeAndCall(
        address proxy,
        address implementation,
        bytes calldata data
    ) external payable;

    function transferOwnership(address newOwner) external;

    function owner() external view returns (address);
}

interface ICHFStablecoinDaoUpgradeablePausable {
    function grantRole(bytes32 role, address account) external;

    function revokeRole(bytes32 role, address account) external;

    function pause() external;

    function unpause() external;
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}

contract CHFStablecoinDao {
    ICHFStablecoinDaoUpgradeablePausable public immutable token;
    IProxyAdmin public immutable proxyAdmin;
    address public immutable proxyAddress;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = 0x00;

    uint256 public proposalCount;
    uint256 public constant votingDuration = 3 days;
    uint256 public executionDelay = 1 days;
    uint256 public constant quorumPercent = 10;

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        Action action;
        address targetAccount;
        address newImplementation;
        bool paused;
        uint256 startTime;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        uint256 approvedTime;
    }

    enum Action {
        GrantMinter,
        RevokeMinter,
        GrantAdmin,
        RevokeAdmin,
        Pause,
        Unpause,
        Upgrade
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    constructor(
        address tokenAddress,
        address proxyAdminAddress,
        address proxyAddr
    ) {
        require(tokenAddress != address(0), "Invalid token address");
        require(proxyAdminAddress != address(0), "Invalid proxy admin address");
        require(proxyAddr != address(0), "Invalid proxy address");
        token = ICHFStablecoinDaoUpgradeablePausable(tokenAddress);
        proxyAdmin = IProxyAdmin(proxyAdminAddress);

        //proxyAdmin = ProxyAdmin(proxyAdminAddress);// if using the actual contract
        proxyAddress = proxyAddr;
    }

    // debugging event:
    event Log(string message);

    event ProposalCreated(
        uint256 id,
        address proposer,
        string description,
        Action action
    );
    event VoteCast(
        uint256 proposalId,
        address voter,
        bool support,
        uint256 weight
    );
    event ProposalApproved(uint256 proposalId, uint256 approvedTime);
    event ProposalExecuted(uint256 proposalId);

    // ========================
    // Proposal Creation
    // ========================

    function createProposalUpgrade(
        address newImpl,
        string memory description
    ) external returns (uint256) {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            description: description,
            action: Action.Upgrade,
            targetAccount: address(0),
            newImplementation: newImpl,
            paused: false,
            startTime: block.timestamp,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            approvedTime: 0
        });
        emit ProposalCreated(
            proposalCount,
            msg.sender,
            description,
            Action.Upgrade
        );
        return proposalCount;
    }

    // ========================
    // Voting
    // ========================

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            block.timestamp <= proposal.startTime + votingDuration,
            "Voting ended"
        );
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        uint256 voterWeight = IERC20(address(token)).balanceOf(msg.sender);
        require(voterWeight > 0, "No voting power");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.yesVotes += voterWeight;
        } else {
            proposal.noVotes += voterWeight;
        }

        emit VoteCast(proposalId, msg.sender, support, voterWeight);
    }

    // ========================
    // Proposal Approval
    // ========================

    function approveProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            block.timestamp > proposal.startTime + votingDuration,
            "Voting not ended"
        );
        require(proposal.approvedTime == 0, "Already approved");

        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = IERC20(address(token)).totalSupply();
        require(
            (totalVotes * 100) / totalSupply >= quorumPercent,
            "Quorum not met"
        );
        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");

        proposal.approvedTime = block.timestamp;
        emit ProposalApproved(proposalId, proposal.approvedTime);
    }

    // ========================
    // Execute Proposal
    // ========================

    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(proposal.approvedTime > 0, "Not approved yet");
        require(
            block.timestamp >= proposal.approvedTime + executionDelay,
            "Execution delay not passed"
        );

        proposal.executed = true;
        emit Log("Passed checks");

        if (proposal.action == Action.Upgrade) {
            emit Log("Validating upgrade implementation");
            require(
                proposal.newImplementation != address(0),
                "Invalid implementation"
            );

            emit Log("Checking ProxyAdmin ownership");
            require(
                proxyAdmin.owner() == address(this),
                "DAO not ProxyAdmin owner"
            );

            emit Log("Trying upgrade");
            bytes memory initData = abi.encodeWithSignature(
                "initializeV2(address)",
                address(this)
            );

            // External call - if it fails, revert the entire tx (proposal.executed stays true)
            proxyAdmin.upgradeAndCall(
                proxyAddress,
                proposal.newImplementation,
                initData
            );

            emit Log("Upgrade succeed");
        } else if (proposal.action == Action.GrantMinter) {
            token.grantRole(MINTER_ROLE, proposal.targetAccount);
        } else if (proposal.action == Action.RevokeMinter) {
            token.revokeRole(MINTER_ROLE, proposal.targetAccount);
        } else if (proposal.action == Action.GrantAdmin) {
            token.grantRole(ADMIN_ROLE, proposal.targetAccount);
        } else if (proposal.action == Action.RevokeAdmin) {
            token.revokeRole(ADMIN_ROLE, proposal.targetAccount);
        } else if (proposal.action == Action.Pause) {
            token.pause();
        } else if (proposal.action == Action.Unpause) {
            token.unpause();
        }

        emit ProposalExecuted(proposalId);
    }

    // ========================
    // Set Execution Delay
    // ========================

    function setExecutionDelay(uint256 newDelay) external {
        require(newDelay <= 7 days, "Too long");
        executionDelay = newDelay;
    }
}
