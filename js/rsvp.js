$(document).ready(function () {
	window.rsvpform = new RSVPForm($('#rsvp-form'));
});


var SpotifyTrackSearch = function(input, hidden) {
	var self = this;

	function trackNameAndArtists(suggestion) {
		return suggestion.name
			+ ' by '
			+ suggestion.artists.map(function (artist) { return artist.name }).join(', ');
	}

	function uniqBy(array, keyFunction) {
		var seen = {};
		return array.filter(function(item) {
			var key = keyFunction(item);
			return seen.hasOwnProperty(key) ? false : (seen[key] = true);
		})
	}

	this.initialize = function(input, hidden) {
		self.input = input;
		self.hidden = hidden;

		self.input.typeahead({
				minLength: 3,
				highlight: true,
			},{
				source: function( query, callback ) {
					$.ajax({
						url: 'https://api.spotify.com/v1/search',
						data: {
							q: query,
							type: 'track'
						},
						success: function (response) {
							callback(uniqBy(response.tracks.items, trackNameAndArtists));
						}
					});
				},
				displayKey: trackNameAndArtists
			}
		).on('typeahead:selected', function(event, suggestion, dataset) {
			self.hidden.val(suggestion.id);
		}).change(function() {
			self.hidden.val('');
		});
	};

	this.initialize(input, hidden);
};

var RSVPForm = function(form) {
	/**********************
	 * Private variables
	 **********************/
	var self = this;
	var inputs = {};


	/**********************
	 * Initialization
	 **********************/
	this.initialize = function(form) {
		self.form = form;

		self.initializeParsley();
		self.initializeInputs();

		// Show/hide elements appropriately for JS form
		inputs.stepNavButtons.show();
		self.$('.guest1')
			.find('.field-guest-first, .field-guest-last')
			.find('.control-label')
			.show();
		// Set the initial view appropriately
		self.hashChanged();

		$(window).on('hashchange', self.hashChanged);

		// Prevent Enter submitting the form accidentally, but still allow
		//   it to work normally on buttons and in textareas
		self.form.bind('keypress keydown keyup', function(event) {
			if (event.keyCode == 13 &&
				! $(event.target).is(':button,:submit,textarea')) {
				event.preventDefault();
			}
		});

		// Set up button click handlers
		inputs.stepNavButtons.click(self.changeStep);
		inputs.submitButton.click(self.submitAjax);

		// Set up onchange handlers for inputs
		inputs.attendingRadios.change(self.attendanceChanged);
		inputs.guestCount.change(self.guestCountChanged);
		inputs.firstName.change(self.nameChanged);
		inputs.lastName.change(self.nameChanged);

		self.spotifyInput = new SpotifyTrackSearch(
			inputs.song,
			inputs.songId);

		self.updateDynamicFields();

		// Focus the first field
		self.$(':input').first().focus();
	};

	this.initializeInputs = function() {
		inputs.stepNavButtons = self.$('.step-navigation .button-nav');
		inputs.submitButton = self.$('.button-submit');

		inputs.attendingRequired = self.$(':input[data-attending-required]');
		inputs.attendingRadios = self.$('.field-attending :radio');
		inputs.guestCount = self.$('.field-guestcount select');
		inputs.guests = self.$('.guest');
		inputs.firstName = self.$('#user_first_dynamic');
		inputs.lastName = self.$('#user_last_dynamic');

		inputs.guest1First = self.$('#user_first_static');
		inputs.guest1Last = self.$('#user_last_static');

		inputs.song = self.$('.field-song input[type="text"]');
		inputs.songId = self.$('.field-song input[type="hidden"]');
	};

	this.updateDynamicFields = function() {
		self.nameChanged();
		self.attendanceChanged();
		self.guestCountChanged();
	};

	this.initializeParsley = function() {
		// Assign fields to Parsley groups matching their steps so we can
		//  validate each step independently.
		//  Note: this needs to happen *before* Parsley is initialized
		self.steps().each(function () {
			var stepId = $(this).data('step');
			$(this).find(':input').attr('data-parsley-group', stepId)
		});

		self.parsley = self.form.parsley({
			successClass: "has-success",
			errorClass: "has-error",
			classHandler: function (el) {
				return el.$element.closest(".field");
			},
			errorsContainer: function (el) {
				return el.$element.closest(".field");
			},
		});
	};



	/**********************
	 * Accessors
	 **********************/

	// Facilitate search for elements within this form
	this.$ = function(arg) {
		return $(arg, self.form);
	};

	// Get all steps
	this.steps = function() {
		return self.$('[data-step]');
	};

	// Get a step by ID
	this.step = function(stepId) {
		return self.$('[data-step=' + stepId + ']');
	};

	// Get the step that contains the specified element
	this.stepFor = function(selector) {
		return selector.closest('[data-step]');
	};

	this.showAllSteps = function() {
		self.steps().show();
		inputs.stepNavButtons.hide();
	};

	this.firstName = function() {
		return inputs.firstName.val();
	};

	this.lastName = function() {
		return inputs.lastName.val();
	};

	this.attending = function() {
		var attending = inputs.attendingRadios.filter(':checked').val();

		if ('yes' == attending)
			return true;
		else if ('no' == attending)
			return false;
		else
			return undefined;
	};

	this.requireAttendingFields = function(bool) {
		if (bool)
			inputs.attendingRequired.attr('data-parsley-required', '');
		else
			inputs.attendingRequired.removeAttr('data-parsley-required');
	};


	/**********************
	 * Event handlers
	 **********************/
	this.changeStep = function(event) {
		var steps = self.steps();
		var current = self.stepFor($(event.target));
		var currentId = current.data('step');
		var nextId = $(event.target).data('next-step');
		var next = self.step(nextId);

		// only validate going forward. If current group is invalid, do not go further
		// .parsley().validate() returns validation result AND show errors
		if (steps.index(next) > steps.index(current))
			if (false === self.parsley.validate(currentId))
				return;

		// validation was ok. We can go on next step.
		steps.hide();
		self.parsley.reset();
		next.show();
		next.find(':input').first().focus();
	};

	this.guestCountChanged = function() {
		var count = inputs.guestCount.val() || 0;
		inputs.guests.each(function (i, guest) {
			if (i < count)
				$(guest)
					.show()
					.find(':input').attr('data-parsley-required', '');
			else
				$(guest)
					.hide()
					.find(':input').removeAttr('data-parsley-required');
		});

		// If the select box is focused (i.e. the value was set by the user,
		//  not programmatically) then auto-focus the next field
		if (inputs.guestCount.is(':focus')) {
			var stepInputs = self.stepFor(inputs.guestCount).find(':input');
			stepInputs.eq( stepInputs.index(inputs.guestCount) + 1 ).focus();
		}
	};

	this.nameChanged = function() {
		inputs.guest1First.text(self.firstName());
		inputs.guest1Last.text(self.lastName());
	};

	this.attendanceChanged = function() {
		function createAjaxSubmit() {
			return $('<button class="button-submit">RSVP!</button>')
				.click(function (event) {
					if (! self.parsley.validate(thisStep.data('step')))
						event.preventDefault();
					else
						self.submitAjax(event);
				});
		}

		var attending = self.attending();

		var thisStep = self.stepFor(inputs.attendingRadios);
		var nextButton = $('.button-next', thisStep);
		var regretsSubmit = thisStep.find('.button-submit');

		if (false === attending) {
			// If they're not attending, set guest count to 0 and add an
			//  RSVP button
			inputs.guestCount.val(0);
			self.requireAttendingFields(false);
			nextButton.hide();

			if (regretsSubmit.length > 0)
				regretsSubmit.show();
			else
				createAjaxSubmit().appendTo($('.step-navigation', thisStep));
		} else if (true === attending) {
			// If they haven't already specified how many guests, set to 1
			if (! inputs.guestCount.val()) inputs.guestCount.val(1);
			self.requireAttendingFields(true);
			nextButton.show();

			regretsSubmit.hide();
		}

		// Trigger onchange events for the guest count
		inputs.guestCount.change();
	};

	this.hashChanged = function() {
		var hash = location.hash.replace('#','');
		console.log('Hash changed: ' + hash);

		$('.confirm').hide();
		self.steps().hide();
		self.form.hide();

		var confirmation = $('.confirm-' + hash);

		if (confirmation.length)
			confirmation.show();
		else {
			self.form.show()
			self.steps().first().show();
		}
	};


	/**********************
	 * Validation / Submission
	 **********************/
	this.validate = function(event) {
		if (event) event.preventDefault();

		self.parsley.validate();
	};

	this.submitIframe = function(event) {
		if (event) event.preventDefault();

		// Let's create the iFrame used to send our data
		var iframe = document.createElement("iframe");
		iframe.name = "myTarget";
		iframe.style.display = "none";
		document.body.appendChild(iframe);

		// Define what should happen when the response is loaded
		iframe.addEventListener("load", function (data) {
			console.log(data);
			alert("Yeah! Data sent.");
			doSuccess();
		});

		self.form.prop('target', iframe.name);

		self.form.submit();
	};

	this.submitAjax = function(event) {
		if (event) event.preventDefault();

		var button = $(event.target);
		var buttonHtml = button.html();
		function resetButton() {
			button.html(buttonHtml).prop('disabled', false);
		}
		
		button.prop('disabled', true)		;

		if (! self.parsley.validate()) {
			self.showAllSteps();
			resetButton();
			return false;
		}

		function doSuccess(data) {
			location.hash = self.attending() ? 'accept' : 'decline';
			console.log('success!');
			resetButton();
		}

		function doFailure(error) {
			location.hash = 'error';
			$('.error-details').text(error.statusText);
			console.log(error);
			resetButton();
		}

		// We have to send the request via a proxy to make CORS work
		var action = self.form.prop('action').replace(/https?:\/\/docs.google.com/, 'http://fitzell.ca');
		button.html('Submitting...');
		$.post(action, form.serialize())
			.done(doSuccess)
			.fail(function(e) { doFailure(e) });
	};

	this.initialize(form);
};