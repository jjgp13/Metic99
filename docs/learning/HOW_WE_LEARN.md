# How we learn in this project (and the science behind it)

Every change to Metic99 is also a lesson for the owner. This page says
**what learning research has found**, and **how each finding shapes the way
Claude works with you**. The day-to-day procedure is the `learning-loop`
skill (`.claude/skills/learning-loop/SKILL.md`) in feature chats and the
`quiz` skill in your quiz chat. What you've learned is listed in
[`CONCEPTS.md`](CONCEPTS.md) and its review dates in
[`REVIEWS.md`](REVIEWS.md).

The short version: **you learn by doing the thinking, not by reading
someone else's thinking.** Explanations help most *after* you have tried.

---

## 1. The findings

### 1.1 Retrieval practice: pulling an idea out of memory is what stores it
- **Finding:** students who *tested themselves* on a text remembered much
  more a week later than students who re-read it, even though the
  re-readers felt better prepared (Roediger & Karpicke, 2006). A large
  review of study techniques rated practice testing as one of only two
  "high utility" techniques (Dunlosky et al., 2013).
- **How we use it:** after a change, Claude asks you 1–2 questions ("explain
  in your words why GameScene doesn't draw anything itself") instead of
  "does that make sense?".

### 1.2 Generation and pretesting: try before you are told, even if you're wrong
- **Finding:** information you generate yourself is remembered better than
  information you read (the *generation effect*, Slamecka & Graf, 1978).
  Guessing an answer *before* learning it improves learning even when the
  guess is wrong (Kornell, Hays & Bjork, 2009; Richland, Kornell & Kao,
  2009).
- **How we use it:** before Claude shows its plan, you say how you would
  approach the change, or pick between 2–3 options. Wrong answers are
  useful here, not a failure.

### 1.3 Confidence and the hypercorrection effect
- **Finding:** errors you were *sure* about, once corrected, are remembered
  better than errors you were unsure about (Butterfield & Metcalfe, 2001).
  And people are poor judges of their own understanding: reading a clear
  explanation creates an *illusion of competence* (Koriat & Bjork, 2005).
- **How we use it:** Claude sometimes asks "how sure are you, 1–5?". A
  confident wrong answer gets the most attention: that is where the
  biggest learning is.

### 1.4 Self-explanation and elaboration: say *why*
- **Finding:** learners who explain each step to themselves understand and
  transfer much better than those who just read the steps (Chi et al.,
  1994). Asking "why is this true?" (*elaborative interrogation*) also
  helps (Dunlosky et al., 2013).
- **How we use it:** questions ask *why* and *what if*, not *what is it
  called*. Names come after understanding.

### 1.5 Spacing: review across days, not all at once
- **Finding:** the same amount of study spread over time is remembered far
  longer than when it is crammed (Cepeda et al., 2006, a review of 300+
  experiments). The best gap grows as the memory gets stronger.
- **How we use it:** feature work and review are separate. A dedicated
  quiz chat (`/quiz`, also on a Mon/Wed/Fri schedule) asks about concepts
  whose review is due and about the week's features. Each correct answer
  roughly doubles the gap (1 → 3 → 7 → 14 → 30 days); a miss resets it to
  1 day.

### 1.6 Interleaving: mix topics in practice
- **Finding:** practicing mixed problem types beats practicing one type in
  a block, because you learn to recognize *which* idea a problem needs
  (Rohrer & Taylor, 2007).
- **How we use it:** review questions mix topics (a pattern, a game-design
  idea, a testing idea), and Claude sometimes asks "which pattern from
  ARCHITECTURE.md fits this problem?".

### 1.7 Worked examples first, then fade the help
- **Finding:** beginners learn more from studying worked examples than from
  solving problems alone, because problem solving overloads working memory
  (Sweller & Cooper, 1985; *cognitive load theory*, Sweller, 1988). As
  skill grows this flips: detailed examples start to *hurt* experts (the
  *expertise reversal effect*, Kalyuga et al., 2003), so help should fade
  step by step (Renkl & Atkinson, 2003).
- **How we use it:** a new concept gets a full walkthrough of Claude's
  change (the worked example). Once you can explain it, you write the next
  similar change yourself ("your turn"), with hints only if you ask.

### 1.8 Subgoal labels: name the steps
- **Finding:** worked examples teach better when their steps are grouped
  and labeled with *what the step achieves* (Margulieux, Guzdial &
  Catrambone, 2012, for learning programming).
- **How we use it:** walkthroughs are ordered by named subgoals ("1. make
  the test that proves nothing changes, 2. move the code, 3. connect it").

### 1.9 PRIMM: read and predict code before writing it
- **Finding:** a programming-teaching method that goes Predict → Run →
  Investigate → Modify → Make improved learning in schools (Sentance,
  Waite & Kallia, 2019). Reading and tracing code is a separate skill from
  writing it, and comes first.
- **How we use it:** "before you run it, what do you think this prints /
  changes?", then we run it (tests, bots, the game), then you modify it,
  then you make something new.

### 1.10 Feedback: specific, about the work, soon
- **Finding:** feedback helps most when it says where you are, where the
  goal is and what to do next, and is about the task or your reasoning,
  not about you (Hattie & Timperley, 2007).
- **How we use it:** Claude's feedback points at the exact part of your
  answer that was right or missing, and gives the next step.

### 1.11 Small doses: working memory is tiny
- **Finding:** we can hold only a few new things in mind at once
  (cognitive load theory, Sweller, 1988).
- **How we use it:** at most 2 questions per message, short explanations
  (~150 words) before checking back, one new concept at a time.

### 1.12 Deliberate practice at the edge of your ability
- **Finding:** expertise comes from practice aimed at specific weaknesses,
  just beyond what you can do now, with feedback (Ericsson, Krampe &
  Tesch-Römer, 1993). Support given while you work at that edge, then
  removed, is called *scaffolding* (Wood, Bruner & Ross, 1976).
- **How we use it:** "your turn" tasks are picked from concepts you can
  explain but haven't applied yet, and get harder as you go.

### 1.13 One-to-one tutoring works, and the back-and-forth is why
- **Finding:** human tutoring is among the most effective forms of
  teaching. Bloom's famous "2 sigma" (1984) was likely too high; a later
  review found about 0.8 standard deviations (VanLehn, 2011), still large.
  What matters is the interaction: the tutor checks understanding, and the
  learner explains and corrects.
- **How we use it:** the whole loop is a dialogue. Ask about any concept
  you don't know at any moment; Claude answers and then asks you to put it
  in your own words.

### What the science does *not* support
- **"Learning styles"** (visual vs auditory learners, matching teaching to
  a style): no good evidence it helps (Pashler et al., 2008). We use
  diagrams when the *content* is a flow or structure, not because of a style.
- **Re-reading and highlighting** feel productive but are low-utility
  (Dunlosky et al., 2013). That is why explanations end with a question.

---

## 2. What it looks like

**In a feature chat** (one chat per feature):

1. **Your turn to think:** you ask for a change. Claude restates it and
   asks how *you* would do it, or which of 2–3 options you'd pick (and how
   sure you are). Then it waits.
2. **Reason together:** feedback on your answer, Claude's choice and the
   trade-offs, an agreed plan.
3. **Build:** Claude makes the change, verified by tests.
4. **Walkthrough:** the change, step by named step, with "predict what
   happens" moments.
5. **Check:** 1–2 questions in your own words. Feedback.
6. **Record:** new concepts go into `CONCEPTS.md`.

**In the quiz chat** (one chat, kept for quizzes; `/quiz` or the schedule):
~10 minutes, one question at a time, mixing due concepts and this week's
features; feedback after each answer; `REVIEWS.md` gets the new dates.

At any point: ask "what is X?". Say **"just do it"** when you're in a hurry:
Claude skips the waiting, still explains, and leaves the questions as an
optional quiz at the end.

---

## 3. References

- Bloom, B. S. (1984). The 2 sigma problem. *Educational Researcher*, 13(6).
- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high
  confidence are hypercorrected. *J. Exp. Psychology: Learning, Memory, and
  Cognition*, 27(6).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006).
  Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3).
- Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). Eliciting
  self-explanations improves understanding. *Cognitive Science*, 18(3).
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham,
  D. T. (2013). Improving students' learning with effective learning
  techniques. *Psychological Science in the Public Interest*, 14(1).
- Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of
  deliberate practice in the acquisition of expert performance.
  *Psychological Review*, 100(3).
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of
  Educational Research*, 77(1).
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise
  reversal effect. *Educational Psychologist*, 38(1).
- Koriat, A., & Bjork, R. A. (2005). Illusions of competence in monitoring
  one's knowledge during study. *J. Exp. Psychology: LMC*, 31(2).
- Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval
  attempts enhance subsequent learning. *J. Exp. Psychology: LMC*, 35(4).
- Margulieux, L. E., Guzdial, M., & Catrambone, R. (2012). Subgoal-labeled
  instructional material improves performance and transfer in learning to
  develop mobile applications. *Proc. ICER 2012*.
- Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles:
  concepts and evidence. *Psychological Science in the Public Interest*, 9(3).
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from
  example study to problem solving. *Educational Psychologist*, 38(1).
- Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect.
  *J. Exp. Psychology: Applied*, 15(3).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning.
  *Psychological Science*, 17(3).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems
  improves learning. *Instructional Science*, 35(6).
- Sentance, S., Waite, J., & Kallia, M. (2019). Teaching computer
  programming with PRIMM. *Computer Science Education*, 29(2–3).
- Slamecka, N. J., & Graf, P. (1978). The generation effect. *J. Exp.
  Psychology: Human Learning and Memory*, 4(6).
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive
  Science*, 12(2).
- Sweller, J., & Cooper, G. A. (1985). The use of worked examples as a
  substitute for problem solving in learning algebra. *Cognition and
  Instruction*, 2(1).
- VanLehn, K. (2011). The relative effectiveness of human tutoring,
  intelligent tutoring systems, and other tutoring systems. *Educational
  Psychologist*, 46(4).
- Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in
  problem solving. *J. Child Psychology and Psychiatry*, 17(2).
