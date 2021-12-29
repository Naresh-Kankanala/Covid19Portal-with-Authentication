const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error : ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//Authentication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Naresh", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/login/", async (request, response) => {
  const userDetails = request.body;
  const { username, password } = userDetails;
  const verifyUserQuery = `
            SELECT * FROM user
            WHERE username = '${username}';`;
  const dbResponse = await db.get(verifyUserQuery);
  if (dbResponse !== undefined) {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordCorrect === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Naresh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API with Authentication

app.get("/users", authenticateToken, async (request, response) => {
  const selectUserQuery = `
            SELECT * FROM user;`;
  const dbResponse = await db.get(selectUserQuery);
  response.send(dbResponse);
});

//API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
                SELECT state_id AS stateId,
                        state_name AS stateName,
                        population
                FROM state;`;
  const statesList = await db.all(getStatesQuery);
  response.send(statesList);
});

//API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
            SELECT state_id AS stateId,
                    state_name AS stateName,
                    population
            FROM state
            WHERE state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

//API 4

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
            INSERT INTO
            district(district_name, state_id, cases, cured, active, deaths)
            VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  const dbResponse = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
                SELECT district_id AS districtId,
                        district_name AS districtName,
                        state_id AS stateId,
                        cases,
                        cured,
                        active,
                        deaths
                FROM district;`;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
                DELETE FROM user
                WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateQuery = `
            UPDATE district
            SET district_name = '${districtName}',
                state_id = '${stateId}',
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}
            WHERE district_id = ${districtId};`;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `
            SELECT SUM(district.cases) AS totalCases,
                    SUM(district.cured) AS totalCured,
                    SUM(district.active) AS totalActive,
                    SUM(district.deaths) AS totalDeaths
            FROM district 
            INNER JOIN state ON state.state_id = district.state_id
            WHERE district.state_id = ${stateId};`;
    const getStatsQuery = await db.get(getQuery);
    response.send(getStatsQuery);
  }
);

module.exports = app;
