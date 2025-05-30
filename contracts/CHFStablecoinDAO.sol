// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IProxyAdmin {
    function upgrade(address proxy, address implementation) external;
}

interface ICHFStablecoinAdminControlUpgradeable {
    function grantRole(bytes32 role, address account) external;

    function revokeRole(bytes32 role, address account) external;

    function pause() external;

    function unpause() external;
}

contract CHFStablecoinDAO {
    ICHFStablecoinAdminControlUpgradeable public token;
    IProxyAdmin public proxyAdmin;
    address public proxyAddress;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = 0x00;

    uint256 public proposalCount;
    uint256 public votingDuration = 3 days;
    uint256 public quorumPercent = 10;

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        Action action;
        address targetAccount;
        address newImplementation; // For upgrade proposals
        bool paused;
        uint256 startTime;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
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
        token = ICHFStablecoinAdminControlUpgradeable(tokenAddress);
        proxyAdmin = IProxyAdmin(proxyAdminAddress);
        proxyAddress = proxyAddr;
    }

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
    event ProposalExecuted(uint256 id);

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
            executed: false
        });
        emit ProposalCreated(
            proposalCount,
            msg.sender,
            description,
            Action.Upgrade
        );
        return proposalCount;
    }

    // Existing role and pause/unpause proposals omitted for brevity
    // (use same `_createProposal` pattern as before)

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
    // Execute Proposal
    // ========================

    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            block.timestamp > proposal.startTime + votingDuration,
            "Voting not ended"
        );
        require(!proposal.executed, "Already executed");

        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        uint256 totalSupply = IERC20(address(token)).totalSupply();
        require(
            (totalVotes * 100) / totalSupply >= quorumPercent,
            "Quorum not met"
        );
        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");

        if (proposal.action == Action.Upgrade) {
            require(
                proposal.newImplementation != address(0),
                "Invalid implementation"
            );
            // update status before actually doing the effect!
            proposal.executed = true;
            proxyAdmin.upgrade(proxyAddress, proposal.newImplementation);
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
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function totalSupply() external view returns (uint256);
}
