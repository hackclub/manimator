class OnboardingController < ApplicationController
  # Onboarding is a story: π and its friends walk you through it while the editor assembles itself around you, and
  # signing keeps a Pledge.
  def show
    render :story
  end

  # Generations of the idea step, each its own page (ideas_genN_controller.js) so they can be compared side by side:
  # what it tries, and what the personas who played it scored it (out of 10; nil until they have).
  IDEA_GENS = {
    1 => { tries: "Pick a question π plays for you, or type your own. π says what you're building.", scores: nil },
    2 => { tries: "Questions you could settle with your hands. π deals each person a catch, so videos differ. You leave with research notes.", scores: { clear: 6.3, want: 6.3, start: 5.3 } },
    3 => { tries: "The catch is now a twist, dealt on the stage with cards. Notes are written for your twist. Your own question gets its own path.", scores: { clear: 5.5, want: 6.5, start: 4.8 } },
    4 => { tries: "Sixteen questions. π plays a finished 20-second video. Your own question is dealt cards too. Notes: what to draw first, look up and crack. No filming.", scores: { clear: 6.5, want: 6.5, start: 5.8 } },
    5 => { tries: "No dealt twist. Questions from your own life; π asks one thing about you and the sketch redraws as you drag. You leave with a title, a drawn first scene and one mystery.", scores: { clear: 6.5, want: 6.5, start: 5.0 } },
    6 => { tries: "The twist is back as a what-if you pull yourself: π says it is coming, you turn over one of three cards, the sketch redraws. No slider. Same ticket to leave with.", scores: { clear: 7.0, want: 6.8, start: 5.3 } },
    7 => { tries: "Two clicks. You pick; π says \"ooh, wait, what if…\" and a card turns over on the stage by itself; the screen it lands on is the one you leave from, and you can type over the what-if to make it yours.", scores: { clear: 7.3, want: 6.5, start: 5.3, mine: 5.0 } },
    8 => { tries: "Same two clicks, but the idea hatches: it is one scene old and yours to name and look after. The open question is what it keeps asking, not a task.", scores: { clear: 6.8, want: 6.3, start: 4.5, mine: 5.8 } },
    9 => { tries: "Less baby talk, same name box. The card ends on a ten-second first move that puts your own number in. What you type is kept. Four questions to a page.", scores: { clear: 6.8, want: 6.3, start: 6.8, mine: 5.0 } },
    10 => { tries: "The card is three things: a name, the what-if, and one line of π's code. Put your own number in that line and the sketch redraws: the first move, made here.", scores: { clear: 6.8, want: 7.0, start: 7.5, mine: 5.5 } },
    11 => { tries: "One ask, in the real onboarding's look. The card holds, tucks away, the sketch plays alone; then π asks for the one number on a slider, and that button is the way out.", scores: nil }
  }.freeze

  def ideas
    @gen = (params[:gen] || IDEA_GENS.keys.max).to_i
    head :not_found unless IDEA_GENS.key?(@gen)
  end
end
