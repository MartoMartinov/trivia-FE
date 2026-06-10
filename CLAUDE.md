- app name is `Practical Machinist Trivia`
- for desktop optimize for `1440p`
- for mobile the minimal size is `360px CSS pixels`
- translations - yes [english]
- follow the instructions in `./AGENTS.md`

# Additional notes
- when you load the app want to load the first question and also a buffer of questions from every difficulty level. When the player answers the 1st question he is served the next one from the buffer, depending on the requirements and in the same time load the next batch of questions from BA for the buffer for when the user has answered 2nd question.
- You can have multiple sponsor questions and all must be in the end.
- the logo in the header on right is the logo for the sponsor and will be provided from BE on app load .
- the sponsor question should have a countdown timer and the time should be displayed in the UI in the format MM:SS. Should start after the timer for the regular questions is expired.
- the number of people that will win something on every game is provided in admin panel.
- in the leaderboard the current player is shown with his position and the total score.
- in booth display tv there is no current player.
- look into admin panel and backend related specification if it is required to implement the frontend
