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
		self.steps().slice(1).hide();
		inputs.stepNavButtons.show();
		self.$('.guest1')
			.find('.field-guest-first, .field-guest-last')
			.find('.control-label')
			.show();

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

		inputs.attendingRadios = self.$(".field-attending :radio");
		inputs.guestCount = self.$('.field-guestcount select');
		inputs.guests = self.$('.guest');
		inputs.firstName = self.$('#user_first_dynamic');
		inputs.lastName = self.$('#user_last_dynamic');

		inputs.guest1First = self.$('#user_first_static');
		inputs.guest1Last = self.$('#user_last_static');

		inputs.song = self.$('.field-song input');
		inputs.songId = self.$('#song_spotify_id');
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

		self.parsley({
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

	// Get the Parsley object associated with the form
	this.parsley = function() {
		return self.form.parsley();
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


	/**********************
	 * Event handlers
	 **********************/
	this.changeStep = function(event) {
		var parsley = self.parsley();
		var steps = self.steps();
		var current = self.stepFor($(event.target));
		var currentId = current.data('step');
		var nextId = $(event.target).data('next-step');
		var next = self.step(nextId);

		// only validate going forward. If current group is invalid, do not go further
		// .parsley().validate() returns validation result AND show errors
		if (steps.index(next) > steps.index(current))
			if (false === parsley.validate(currentId))
				return;

		// validation was ok. We can go on next step.
		steps.hide();
		parsley.reset();
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
		var attending = self.attending();

		var thisStep = self.stepFor(inputs.attendingRadios);
		var lastStep = self.stepFor(inputs.submitButton);

		if (false === attending) {
			// If they're not attending, set guest count to 0 and set the
			//  navigation buttons to go straight from this step to the last
			inputs.guestCount.val(0);
			thisStep.find('.button-next')
				.data('next-step', lastStep.data('step'));
			lastStep.find('.button-prev')
				.data('next-step', thisStep.data('step'));
		} else { // 'yes' or undefined
			// If they're attending and they haven't already specified how many
			//  guests, then set it to 1
			if (true === attending && ! inputs.guestCount.val())
				inputs.guestCount.val(1);

			// As they're attending, they need to go through the full form
			thisStep.find('.button-next').removeData('next-step');
			lastStep.find('.button-prev').removeData('next-step');
		}

		// Trigger onchange events for the guest count
		inputs.guestCount.change();
	};


	/**********************
	 * Validation / Submission
	 **********************/
	this.validate = function(event) {
		if (event) event.preventDefault();

		self.parsley().validate();
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

		if (! self.parsley().validate())
			return false;

		function doSuccess(data) {
			console.log('success!');
			$('#success').show();
			self.form.hide();
		}

		function doFailure(error) {
			console.log(error)
		}

		// We have to send the request via a proxy to make CORS work
		var action = self.form.prop('action').replace(/https?:\/\/docs.google.com/, 'http://fitzell.ca');
		$.post(action, form.serialize())
			.done(doSuccess)
			.fail(function(e) { doFailure(e) });
	};

	this.initialize(form);
};