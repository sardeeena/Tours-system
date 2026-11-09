const fs = require('fs');

function checkFile(filepath) {
  console.log(`Checking ${filepath}...`);
  if (!fs.existsSync(filepath)) {
    console.error(`File does not exist: ${filepath}`);
    return;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  console.log(`File size: ${content.length} chars, ${content.split('\n').length} lines`);

  // Count dollar-quote blocks
  const dollarMatches = content.match(/\$\$/g);
  if (dollarMatches && dollarMatches.length % 2 !== 0) {
    console.warn(`WARNING: Odd number of $$ delimiters (${dollarMatches.length}) in ${filepath}`);
  } else {
    console.log(`$$ delimiters balanced: ${dollarMatches ? dollarMatches.length : 0}`);
  }

  // Count quotes
  let singleQuotes = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "'" && content[i - 1] !== '\\') {
      singleQuotes++;
    }
  }
  console.log(`Single quotes: ${singleQuotes}`);
}

checkFile('supabase/schema.sql');
checkFile('supabase/seed.sql');
