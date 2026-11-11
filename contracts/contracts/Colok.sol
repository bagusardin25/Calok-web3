// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Colok — a public map of power outlets, Wi-Fi, water refills and seating
/// @notice Anyone can add a spot. Other wallets keep it honest: "Still here" raises a spot's
///         health score and "Report a problem" lowers it. The status every reader sees is
///         computed here, from the score and the time of the last confirmation, so any app that
///         reads this contract gets the same answer.
/// @dev Holds no funds and has no payable function. Coordinates are integer microdegrees
///      (degrees x 1,000,000). Spots are indexed by 0.1-degree cells so that "what is near here"
///      can be answered by view calls alone, without event logs.
contract Colok {
    // ───────────────────────────── Types ─────────────────────────────

    /// @dev Hidden and Closed win over everything else, then a bad score, then age, then a good score.
    enum Status {
        New,
        Verified,
        Stale,
        ReportedGone,
        Closed,
        Hidden
    }

    /// @dev Why a wallet cannot vote on a spot right now. `Ok` means it can.
    enum VoteBlock {
        Ok,
        NotFound,
        Hidden,
        Closed,
        OwnSpot,
        CoolingDown
    }

    struct Spot {
        // slot 0
        address adder;
        int32 lat;
        int32 lng;
        uint32 cell;
        // slot 1
        uint40 createdAt;
        uint40 lastConfirmedAt;
        uint32 confirmations;
        uint32 reports;
        int8 score;
        uint8 amenities;
        uint8 place;
        bool closed;
        bool hidden;
        bool everVerified;
        // slot 2
        address lastConfirmer;
        string name;
        string note;
    }

    /// @dev kind: 1 = "Still here", -1 = "Report a problem".
    struct Vote {
        uint40 votedAt;
        int8 kind;
        uint8 reason;
    }

    struct Mapper {
        uint32 added;
        uint32 confirms;
        uint32 reports;
        uint40 firstAt;
    }

    struct SpotView {
        uint32 id;
        address adder;
        int32 lat;
        int32 lng;
        uint32 cell;
        uint8 amenities;
        uint8 place;
        int8 score;
        Status status;
        bool closed;
        bool hidden;
        uint40 createdAt;
        uint40 lastConfirmedAt;
        address lastConfirmer;
        uint32 confirmations;
        uint32 reports;
        string name;
        string note;
    }

    /// @dev The lighter shape returned for map and list queries: no note, no addresses.
    struct Pin {
        uint32 id;
        int32 lat;
        int32 lng;
        uint8 amenities;
        uint8 place;
        int8 score;
        Status status;
        uint40 lastSeenAt;
        uint32 confirmations;
        uint32 reports;
        string name;
    }

    struct VoteView {
        uint40 votedAt;
        int8 kind;
        uint8 reason;
        uint40 nextAt;
    }

    struct MapperView {
        address wallet;
        uint32 added;
        uint32 confirms;
        uint32 reports;
        uint40 firstAt;
    }

    // ───────────────────────────── Rules ─────────────────────────────

    int32 public constant MAX_LAT = 90_000_000;
    int32 public constant MAX_LNG = 180_000_000;
    /// @notice Cell edge in microdegrees: 0.1 degree, about 11 km.
    int32 public constant CELL_SIZE = 100_000;
    uint32 public constant CELL_ROWS = 1800;
    uint32 public constant CELL_COLUMNS = 3600;

    /// @notice Bit 0 Power, bit 1 Wi-Fi, bit 2 Water, bit 3 Seating.
    uint8 public constant AMENITY_MASK = 0x0F;
    /// @notice Transit, Library, Park, Campus, Mall, Place of worship, Cafe, Other.
    uint8 public constant PLACE_COUNT = 8;
    /// @notice Gone, Broken, No longer free, Wrong place.
    uint8 public constant REASON_COUNT = 4;

    int8 public constant SCORE_MAX = 3;
    int8 public constant SCORE_MIN = -3;
    int8 public constant VERIFIED_AT = 2;
    int8 public constant GONE_AT = -2;
    uint256 public constant COOLDOWN = 30 days;
    uint256 public constant STALE_AFTER = 90 days;

    uint256 public constant NAME_MIN = 3;
    uint256 public constant NAME_MAX = 48;
    uint256 public constant NOTE_MAX = 160;

    uint256 public constant MAX_CELLS = 48;
    uint256 public constant MAX_PER_CELL = 50;
    uint256 public constant MAX_PAGE = 100;

    // ───────────────────────────── State ─────────────────────────────

    address public owner;

    uint32 private _spotCount;
    uint32 private _verifiedOnce;
    uint32 private _confirmations;
    uint32 private _reports;

    mapping(uint256 => Spot) private _spots;
    mapping(uint256 => mapping(address => Vote)) private _votes;
    mapping(uint32 => uint32[]) private _cellSpots;
    mapping(address => uint32[]) private _spotsBy;
    mapping(address => uint32[]) private _votedOn;
    mapping(address => Mapper) private _mappers;
    address[] private _mapperList;

    // ───────────────────────────── Events ─────────────────────────────

    event SpotAdded(
        uint256 indexed id,
        address indexed adder,
        uint32 indexed cell,
        int32 lat,
        int32 lng,
        uint8 amenities,
        uint8 place,
        string name
    );
    event SpotConfirmed(uint256 indexed id, address indexed wallet, int8 score);
    event SpotReported(uint256 indexed id, address indexed wallet, uint8 reason, int8 score);
    event SpotClosed(uint256 indexed id, address indexed adder);
    event SpotHiddenSet(uint256 indexed id, bool hidden);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ───────────────────────────── Errors ─────────────────────────────

    error InvalidLatitude();
    error InvalidLongitude();
    error NoAmenities();
    error InvalidAmenities();
    error InvalidPlace();
    error InvalidName();
    error InvalidNote();
    error InvalidReason();
    error SpotNotFound();
    error SpotIsHidden();
    error SpotIsClosed();
    error OwnSpot();
    error CoolingDown(uint40 nextAt);
    error NotAdder();
    error NotOwner();
    error ZeroAddress();
    error TooManyCells();
    error TooManyIds();
    error InvalidLimit();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ───────────────────────────── Writes ─────────────────────────────

    /// @notice Adds a public spot. The caller becomes its adder and cannot confirm it.
    /// @param lat Latitude in microdegrees, -90,000,000 to 90,000,000.
    /// @param lng Longitude in microdegrees, -180,000,000 to 180,000,000.
    /// @param amenities Bitmask of at least one amenity (see AMENITY_MASK).
    /// @param place Place type, 0 to PLACE_COUNT - 1.
    /// @param name 3 to 48 bytes.
    /// @param note 0 to 160 bytes, for example where exactly the outlet is.
    function addSpot(
        int32 lat,
        int32 lng,
        uint8 amenities,
        uint8 place,
        string calldata name,
        string calldata note
    ) external returns (uint256 id) {
        if (lat < -MAX_LAT || lat > MAX_LAT) revert InvalidLatitude();
        if (lng < -MAX_LNG || lng > MAX_LNG) revert InvalidLongitude();
        if (amenities == 0) revert NoAmenities();
        if (amenities & ~AMENITY_MASK != 0) revert InvalidAmenities();
        if (place >= PLACE_COUNT) revert InvalidPlace();
        uint256 nameLength = bytes(name).length;
        if (nameLength < NAME_MIN || nameLength > NAME_MAX) revert InvalidName();
        if (bytes(note).length > NOTE_MAX) revert InvalidNote();

        uint32 cell = cellOf(lat, lng);
        uint32 newId = ++_spotCount;
        id = newId;

        _spots[newId] = Spot({
            adder: msg.sender,
            lat: lat,
            lng: lng,
            cell: cell,
            createdAt: uint40(block.timestamp),
            lastConfirmedAt: 0,
            confirmations: 0,
            reports: 0,
            score: 0,
            amenities: amenities,
            place: place,
            closed: false,
            hidden: false,
            everVerified: false,
            lastConfirmer: address(0),
            name: name,
            note: note
        });

        _cellSpots[cell].push(newId);
        _spotsBy[msg.sender].push(newId);
        _mapper(msg.sender).added += 1;

        emit SpotAdded(id, msg.sender, cell, lat, lng, amenities, place, name);
    }

    /// @notice "Still here": the caller says the spot exists and works. Raises the score by one, up to +3.
    /// @dev Public: this records that the caller claims to have been at the spot at this time.
    function confirm(uint256 spotId) external {
        Spot storage s = _votable(spotId);
        _recordVote(spotId, 1, 0);

        if (s.score < SCORE_MAX) s.score += 1;
        s.lastConfirmedAt = uint40(block.timestamp);
        s.lastConfirmer = msg.sender;
        s.confirmations += 1;
        if (!s.everVerified && s.score >= VERIFIED_AT) {
            s.everVerified = true;
            _verifiedOnce += 1;
        }

        _confirmations += 1;
        _mapper(msg.sender).confirms += 1;
        emit SpotConfirmed(spotId, msg.sender, s.score);
    }

    /// @notice "Report a problem". Lowers the score by one, down to -3.
    /// @param reason 0 Gone, 1 Broken, 2 No longer free, 3 Wrong place.
    function report(uint256 spotId, uint8 reason) external {
        if (reason >= REASON_COUNT) revert InvalidReason();
        Spot storage s = _votable(spotId);
        _recordVote(spotId, -1, reason);

        if (s.score > SCORE_MIN) s.score -= 1;
        s.reports += 1;

        _reports += 1;
        _mapper(msg.sender).reports += 1;
        emit SpotReported(spotId, msg.sender, reason, s.score);
    }

    /// @notice The adder takes their own spot off the map, for good.
    function closeSpot(uint256 spotId) external {
        Spot storage s = _existing(spotId);
        if (s.adder != msg.sender) revert NotAdder();
        if (s.closed) revert SpotIsClosed();
        s.closed = true;
        emit SpotClosed(spotId, msg.sender);
    }

    /// @notice Moderation: hides a spot that breaks the rules (a private home, abusive text).
    ///         The data stays on chain; the owner cannot change coordinates, text or score.
    function setHidden(uint256 spotId, bool hidden) external onlyOwner {
        Spot storage s = _existing(spotId);
        s.hidden = hidden;
        emit SpotHiddenSet(spotId, hidden);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ───────────────────────────── Geography ─────────────────────────────

    /// @notice The 0.1-degree cell a coordinate falls in: row * 3600 + column.
    /// @dev Row counts up from the south pole, column eastwards from -180. Offsetting before the
    ///      division keeps both operands non-negative, so truncation equals floor for negative
    ///      coordinates too. The north pole joins the top row; +180 wraps to column 0 (= -180).
    function cellOf(int32 lat, int32 lng) public pure returns (uint32) {
        if (lat < -MAX_LAT || lat > MAX_LAT) revert InvalidLatitude();
        if (lng < -MAX_LNG || lng > MAX_LNG) revert InvalidLongitude();
        uint32 row = uint32(uint256(int256(lat) + int256(MAX_LAT)) / uint256(int256(CELL_SIZE)));
        uint32 col = uint32(uint256(int256(lng) + int256(MAX_LNG)) / uint256(int256(CELL_SIZE)));
        if (row == CELL_ROWS) row = CELL_ROWS - 1;
        if (col == CELL_COLUMNS) col = 0;
        return row * CELL_COLUMNS + col;
    }

    // ───────────────────────────── Reads ─────────────────────────────

    function spotCount() external view returns (uint256) {
        return _spotCount;
    }

    function getSpot(uint256 spotId) external view returns (SpotView memory) {
        _existing(spotId);
        return _view(spotId);
    }

    /// @notice Spots with ids below `cursor`, newest first; cursor 0 starts at the latest spot.
    ///         Pass the returned `next` (the oldest id in the page) to continue; it is 0 when
    ///         nothing older is left. Hidden and closed spots are included, flagged as such.
    function getSpots(uint256 cursor, uint256 limit) external view returns (SpotView[] memory page, uint256 next) {
        if (limit == 0 || limit > MAX_PAGE) revert InvalidLimit();
        uint256 top = cursor == 0 || cursor > _spotCount ? _spotCount : cursor - 1;
        uint256 n = top < limit ? top : limit;
        page = new SpotView[](n);
        for (uint256 i; i < n; ++i) {
            page[i] = _view(top - i);
        }
        next = top > n ? top - n + 1 : 0;
    }

    /// @notice Unknown ids come back as an empty entry with id 0.
    function getSpotsByIds(uint256[] calldata ids) external view returns (SpotView[] memory page) {
        if (ids.length > MAX_PAGE) revert TooManyIds();
        page = new SpotView[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            if (ids[i] != 0 && ids[i] <= _spotCount) page[i] = _view(ids[i]);
        }
    }

    /// @notice Open spots in the given cells, newest first within each cell, at most `perCell` each.
    ///         Closed and hidden spots are left out. Reported-gone and stale spots are included;
    ///         the caller decides whether to show them.
    function getSpotsInCells(uint32[] calldata cells, uint256 perCell) external view returns (Pin[] memory pins) {
        if (cells.length > MAX_CELLS) revert TooManyCells();
        if (perCell == 0 || perCell > MAX_PER_CELL) revert InvalidLimit();

        uint32[] memory found = new uint32[](cells.length * perCell);
        uint256 n;
        for (uint256 c; c < cells.length; ++c) {
            uint32[] storage ids = _cellSpots[cells[c]];
            uint256 taken;
            for (uint256 i = ids.length; i > 0 && taken < perCell; --i) {
                uint32 id = ids[i - 1];
                Spot storage s = _spots[id];
                if (s.closed || s.hidden) continue;
                found[n++] = id;
                ++taken;
            }
        }

        pins = new Pin[](n);
        for (uint256 i; i < n; ++i) {
            pins[i] = _pin(found[i]);
        }
    }

    /// @notice How many spots were ever registered in each cell, closed and hidden ones included.
    ///         A count above the `perCell` used for getSpotsInCells means some spots were left out.
    function cellCounts(uint32[] calldata cells) external view returns (uint32[] memory counts) {
        if (cells.length > MAX_PAGE * 4) revert TooManyCells();
        counts = new uint32[](cells.length);
        for (uint256 i; i < cells.length; ++i) {
            counts[i] = uint32(_cellSpots[cells[i]].length);
        }
    }

    function statusOf(uint256 spotId) external view returns (Status) {
        return _status(_existing(spotId));
    }

    /// @notice The wallet's latest vote on a spot. `nextAt` is when it may vote again (0 if never voted).
    function voteOf(uint256 spotId, address wallet) external view returns (VoteView memory v) {
        Vote storage vote = _votes[spotId][wallet];
        v.votedAt = vote.votedAt;
        v.kind = vote.kind;
        v.reason = vote.reason;
        v.nextAt = vote.votedAt == 0 ? 0 : uint40(uint256(vote.votedAt) + COOLDOWN);
    }

    /// @notice Whether `wallet` may confirm or report the spot now, and if not, why.
    ///         For CoolingDown, `nextAt` is the first moment it may vote again.
    function canVote(uint256 spotId, address wallet) external view returns (VoteBlock block_, uint40 nextAt) {
        if (spotId == 0 || spotId > _spotCount) return (VoteBlock.NotFound, 0);
        Spot storage s = _spots[spotId];
        if (s.hidden) return (VoteBlock.Hidden, 0);
        if (s.closed) return (VoteBlock.Closed, 0);
        if (s.adder == wallet) return (VoteBlock.OwnSpot, 0);
        uint40 last = _votes[spotId][wallet].votedAt;
        if (last != 0 && block.timestamp < uint256(last) + COOLDOWN) {
            return (VoteBlock.CoolingDown, uint40(uint256(last) + COOLDOWN));
        }
        return (VoteBlock.Ok, 0);
    }

    /// @notice Ids of the spots a wallet added, oldest first.
    function spotsBy(address wallet) external view returns (uint32[] memory) {
        return _spotsBy[wallet];
    }

    /// @notice Ids of the spots a wallet has confirmed or reported, each once, in the order first voted.
    function votedOn(address wallet) external view returns (uint32[] memory) {
        return _votedOn[wallet];
    }

    function mapperOf(address wallet) external view returns (MapperView memory) {
        Mapper storage m = _mappers[wallet];
        return MapperView(wallet, m.added, m.confirms, m.reports, m.firstAt);
    }

    /// @notice Every wallet that has added, confirmed or reported, in order of first contribution.
    function getMappers(uint256 cursor, uint256 limit) external view returns (MapperView[] memory page) {
        if (limit == 0 || limit > MAX_PAGE) revert InvalidLimit();
        uint256 total = _mapperList.length;
        if (cursor >= total) return new MapperView[](0);
        uint256 n = total - cursor < limit ? total - cursor : limit;
        page = new MapperView[](n);
        for (uint256 i; i < n; ++i) {
            address wallet = _mapperList[cursor + i];
            Mapper storage m = _mappers[wallet];
            page[i] = MapperView(wallet, m.added, m.confirms, m.reports, m.firstAt);
        }
    }

    /// @notice `verified` counts spots that have ever reached a score of +2, whatever they are now.
    function stats()
        external
        view
        returns (uint32 spots, uint32 verified, uint32 confirmations, uint32 reports, uint32 mappers)
    {
        return (_spotCount, _verifiedOnce, _confirmations, _reports, uint32(_mapperList.length));
    }

    // ───────────────────────────── Internals ─────────────────────────────

    function _existing(uint256 spotId) private view returns (Spot storage) {
        if (spotId == 0 || spotId > _spotCount) revert SpotNotFound();
        return _spots[spotId];
    }

    function _votable(uint256 spotId) private view returns (Spot storage s) {
        s = _existing(spotId);
        if (s.hidden) revert SpotIsHidden();
        if (s.closed) revert SpotIsClosed();
        if (s.adder == msg.sender) revert OwnSpot();
        uint40 last = _votes[spotId][msg.sender].votedAt;
        if (last != 0 && block.timestamp < uint256(last) + COOLDOWN) {
            revert CoolingDown(uint40(uint256(last) + COOLDOWN));
        }
    }

    function _recordVote(uint256 spotId, int8 kind, uint8 reason) private {
        Vote storage v = _votes[spotId][msg.sender];
        if (v.votedAt == 0) _votedOn[msg.sender].push(uint32(spotId));
        _votes[spotId][msg.sender] = Vote(uint40(block.timestamp), kind, reason);
    }

    function _mapper(address wallet) private returns (Mapper storage m) {
        m = _mappers[wallet];
        if (m.firstAt == 0) {
            m.firstAt = uint40(block.timestamp);
            _mapperList.push(wallet);
        }
    }

    /// @dev The add counts as the first sighting, so a spot nobody confirms still goes stale.
    function _lastSeen(Spot storage s) private view returns (uint40) {
        return s.lastConfirmedAt != 0 ? s.lastConfirmedAt : s.createdAt;
    }

    function _status(Spot storage s) private view returns (Status) {
        if (s.hidden) return Status.Hidden;
        if (s.closed) return Status.Closed;
        if (s.score <= GONE_AT) return Status.ReportedGone;
        if (block.timestamp > uint256(_lastSeen(s)) + STALE_AFTER) return Status.Stale;
        if (s.score >= VERIFIED_AT) return Status.Verified;
        return Status.New;
    }

    function _view(uint256 spotId) private view returns (SpotView memory v) {
        Spot storage s = _spots[spotId];
        v.id = uint32(spotId);
        v.adder = s.adder;
        v.lat = s.lat;
        v.lng = s.lng;
        v.cell = s.cell;
        v.amenities = s.amenities;
        v.place = s.place;
        v.score = s.score;
        v.status = _status(s);
        v.closed = s.closed;
        v.hidden = s.hidden;
        v.createdAt = s.createdAt;
        v.lastConfirmedAt = s.lastConfirmedAt;
        v.lastConfirmer = s.lastConfirmer;
        v.confirmations = s.confirmations;
        v.reports = s.reports;
        v.name = s.name;
        v.note = s.note;
    }

    function _pin(uint32 spotId) private view returns (Pin memory p) {
        Spot storage s = _spots[spotId];
        p.id = spotId;
        p.lat = s.lat;
        p.lng = s.lng;
        p.amenities = s.amenities;
        p.place = s.place;
        p.score = s.score;
        p.status = _status(s);
        p.lastSeenAt = _lastSeen(s);
        p.confirmations = s.confirmations;
        p.reports = s.reports;
        p.name = s.name;
    }
}
