import { looksLikeAName, isDiscourseOnly, citesNameAsAnIntroduction } from "../../packages/index/src/pipeline/speaker-name-rules.js";
const cases = [
  ["Hello Everyone, thanks for joining.", "Everyone"],
  ["Welcome Everyone to the session.", "Everyone"],
  ["Hey Everyone welcome aboard.", "Everyone"],
  ["Thanks All for being here.", "All"],
  ["Hi Guys, let us start.", "Guys"],
  ["Hi There, can you hear me?", "There"],
  ["Welcome Back to the second session.", "Back"],
  ["Welcome To the annual conference.", "To"],
  ["Thank you So much everyone.", "So"],
  ["I'm Sorry about the delay.", "Sorry"],
  ["I am Not sure about that.", "Not"],
  ["That's Great news for us.", "Great"],
  ["This is Important for all of you.", "Important"],
  ["Thank you Monday for the slot.", "Monday"],
  ["Monday with us marks the deadline.", "Monday"],
  ["Welcome Diwali celebrations this week.", "Diwali"],
  ["This is India speaking on the panel.", "India"],
  ["Coming up next, Mumbai from the west zone.", "Mumbai"],
  ["Google here has an announcement.", "Google"],
  ["English speaking students may apply.", "English"],
];
let refused = 0;
for (const [text, name] of cases) {
  const ships = looksLikeAName(name) && !isDiscourseOnly(name) && citesNameAsAnIntroduction(text, name);
  if (!ships) refused++;
  console.log(`${ships ? "SHIPS" : "refused"} | ${name} | ${text}`);
}
console.log(`--- refused ${refused}/20`);

