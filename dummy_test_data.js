// Dummy Test Data for AIUB Sports Portal
// 200 Team Names for Tournament Testing

const teamNames = [
  "AIUB Eagles",
  "Cyber Warriors",
  "Tech Titans",
  "Code Crusaders",
  "Digital Dynamos",
  "Byte Bandits",
  "Pixel Pioneers",
  "Nexus Ninjas",
  "Quantum Quakes",
  "Binary Beasts",
  "Logic Legends",
  "Syntax Storm",
  "Algo Allies",
  "Cypher Crew",
  "Data Defenders",
  "Firewall Force",
  "Kernel Kings",
  "Protocol Pros",
  "Cache Commanders",
  "Thread Titans",
  "Stack Soldiers",
  "Heap Heroes",
  "Loop Legends",
  "Array Avengers",
  "Tuple Troopers",
  "Object Oracles",
  "Class Champions",
  "Instance Invaders",
  "Variable Vikings",
  "Constant Crew",
  "Float Force",
  "Integer Infantry",
  "Boolean Bravos",
  "String Sentinels",
  "Char Challengers",
  "Pointer Phantoms",
  "Reference Rangers",
  "Memory Masters",
  "Storage Squad",
  "Disk Destroyers",
  "Cloud Commandos",
  "Server Spartans",
  "Client Cavaliers",
  "Router Rangers",
  "Switch Soldiers",
  "Hub Heroes",
  "Modem Mavericks",
  "Gateway Gladiators",
  "Protocol Pirates",
  "Packet Pals",
  "Frame Fighters",
  "Cell Commanders",
  "Bandwidth Bandits",
  "Latency Legends",
  "Throughput Troopers",
  "UDP Unicorns",
  "TCP Titans",
  "HTTP Heroes",
  "HTTPS Hyenas",
  "FTP Fighters",
  "SFTP Sentinels",
  "SSH Spartans",
  "VPN Vikings",
  "SSL Snakes",
  "TLS Tigers",
  "OAuth Owls",
  "JWT Jaguars",
  "API Assassins",
  "REST Rangers",
  "GraphQL Guardians",
  "SOAP Soldiers",
  "Microservice Masters",
  "Monolith Marauders",
  "Container Commandos",
  "Docker Defenders",
  "Kubernetes Kings",
  "Jenkins Jesters",
  "Git Gurus",
  "GitHub Ghosts",
  "GitLab Gladiators",
  "CI/CD Champions",
  "DevOps Defenders",
  "Agile Avengers",
  "Scrum Soldiers",
  "Kanban Knights",
  "Sprint Spartans",
  "User Story Sentinels",
  "Acceptance Angels",
  "Test Tornadoes",
  "Debug Detectives",
  "Error Eliminators",
  "Bug Busters",
  "Crash Crushers",
  "Exception Exterminators",
  "Stack Overflow Squad",
  "Memory Leak Hunters",
  "Race Condition Raiders",
  "Deadlock Destroyers",
  "Thread Safety Troopers",
  "Mutex Monks",
  "Semaphore Sentinels",
  "Semaphore Squad",
  "Lock Legends",
  "Synchronization Soldiers",
  "Concurrent Commanders",
  "Parallel Pioneers",
  "Asynchronous Avengers",
  "Synchronous Sentinels",
  "Callback Commandos",
  "Promise Pioneers",
  "Async Assassins",
  "Thread Pool Troopers",
  "Garbage Collectors",
  "Compiler Crew",
  "Interpreter Invaders",
  "Assembler Avengers",
  "Machine Code Masters",
  "Binary Brains",
  "Hex Heroes",
  "Octal Oracles",
  "Decimal Defenders",
  "ASCII Assassins",
  "Unicode Unicorns",
  "UTF-8 Titans",
  "HTML Hurricanes",
  "CSS Cyclones",
  "JavaScript Jetstreams",
  "Python Pythons",
  "Java Juggernauts",
  "C Sharp Sharks",
  "C Minus Minions",
  "C Plus Plus Penguins",
  "Ruby Rebels",
  "PHP Phantoms",
  "Go Gophers",
  "Rust Rangers",
  "Swift Swans",
  "Kotlin Knights",
  "TypeScript Tornadoes",
  "React Rangers",
  "Angular Assassins",
  "Vue Vultures",
  "Node Ninjas",
  "Express Eagles",
  "MongoDB Monkeys",
  "PostgreSQL Pumas",
  "MySQL Mambas",
  "SQLite Squids",
  "Redis Rhinos",
  "Elasticsearch Elephants",
  "Kafka Koalas",
  "RabbitMQ Rams",
  "DynamoDB Dolphins",
  "S3 Swallows",
  "Lambda Leopards",
  "EC2 Eagles",
  "SageMaker Skunks",
  "Azure Armadillos",
  "GCP Geckos",
  "Firebase Falcons",
  "Heroku Hippos",
  "Netlify Narwhals",
  "Vercel Vipers",
  "Docker Dolphins",
  "Kubernetes Komodos",
  "Terraform Turtles",
  "Ansible Antelopes",
  "Chef Chinchillas",
  "Puppet Pandas",
  "SaltStack Salamanders",
  "Prometheus Panthers",
  "Grafana Giraffes",
  "Kibana Kangaroos",
  "Elasticsearch Eagles",
  "Splunk Spiders",
  "Datadog Dalmatians",
  "New Relic Narwhals",
  "Sentry Seals",
  "LogRocket Llamas",
  "Bugsnag Baboons",
  "Rollbar Rhinos",
  "Sentry Sharks",
  "Airbrake Ants",
  "Raygun Raccoons",
  "Sentry Serpents",
  "Rollbar Rats"
];

// Function to generate match pairings for tournament
function generateMatchPairings(teams) {
  if (teams.length % 2 !== 0) {
    // Add a "bye" team if odd number
    teams = [...teams, "BYE"];
  }
  
  const matches = [];
  const numTeams = teams.length;
  
  // For single elimination, we need (n-1) matches to determine a winner
  const totalMatches = numTeams - 1;
  
  // Generate round-robin first round matches
  let firstRoundMatches = Math.floor(numTeams / 2);
  
  // Create first round matches
  for (let i = 0; i < firstRoundMatches; i++) {
    matches.push({
      round: 1,
      matchNumber: i + 1,
      team1: teams[i],
      team2: teams[numTeams - 1 - i]
    });
  }
  
  return {
    totalTeams: teams.length,
    totalMatches: totalMatches,
    firstRoundMatches: firstRoundMatches,
    matches: matches
  };
}

// Function to create dummy pre-registration data for testing
function generatePreRegistrationData(numEntries = 50) {
  const preRegistrations = [];
  const games = ["Football", "Basketball", "Cricket", "Volleyball", "Badminton", "Chess", "Table Tennis"];
  
  for (let i = 0; i < numEntries; i++) {
    preRegistrations.push({
      studentId: `18-${Math.floor(10000 + Math.random() * 90000)}-1`,
      gameName: games[Math.floor(Math.random() * games.length)],
      tournament: "Annual Sports Festival",
      adminRegisteredBy: "admin",
      registrationDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending"
    });
  }
  
  return preRegistrations;
}

// Function to generate sample team data for testing
function generateTeamData(numTeams = 200) {
  const teams = [];
  
  for (let i = 0; i < numTeams; i++) {
    teams.push({
      id: i + 1,
      tournamentId: 1,
      gameName: "Football",
      teamName: teamNames[i % teamNames.length] + ` ${Math.floor(i / teamNames.length) + 1}`,
      leaderId: `18-${Math.floor(10000 + Math.random() * 90000)}-1`,
      members: [
        `18-${Math.floor(10000 + Math.random() * 90000)}-1`,
        `18-${Math.floor(10000 + Math.random() * 90000)}-2`,
        `18-${Math.floor(10000 + Math.random() * 90000)}-3`
      ],
      status: "confirmed",
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      paymentStatus: Math.random() > 0.3 ? "paid" : "pending"
    });
  }
  
  return teams;
}

// Export all functions and data
module.exports = {
  teamNames,
  generateMatchPairings,
  generatePreRegistrationData,
  generateTeamData
};

// If running this file directly, show some examples
if (require.main === module) {
  console.log("=== AIUB Sports Portal Test Data ===");
  console.log(`Total Team Names Available: ${teamNames.length}`);
  console.log(`Sample Team Names: ${teamNames.slice(0, 5).join(', ')}`);
  
  console.log("\n=== Tournament Match Calculation ===");
  const matchResult = generateMatchPairings(teamNames.slice(0, 200));
  console.log(`For ${matchResult.totalTeams} teams:`);
  console.log(`- Total matches needed: ${matchResult.totalMatches}`);
  console.log(`- First round matches: ${matchResult.firstRoundMatches}`);
  
  console.log("\n=== Sample Pre-Registration Data ===");
  const preRegData = generatePreRegistrationData(5);
  console.log("Sample pre-registration entries:");
  preRegData.forEach((reg, index) => {
    console.log(`${index + 1}. Student: ${reg.studentId}, Game: ${reg.gameName}, Status: ${reg.status}`);
  });
  
  console.log("\n=== Sample Team Data ===");
  const teamData = generateTeamData(5);
  console.log("Sample team entries:");
  teamData.forEach((team, index) => {
    console.log(`${index + 1}. Team: ${team.teamName}, Leader: ${team.leaderId}, Members: ${team.members.length}, Status: ${team.status}`);
  });
}