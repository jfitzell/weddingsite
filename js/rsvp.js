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
	var self = this;

	this.initialize = function(form) {
		self.form = form;

		self.initializeParsley();

		// Hide inactive steps and hook up step navigation UI elements
		self.form.find('.step').slice(1).hide();
		self.form.find('.step-navigation .button-nav').show();
		self.form.find('.button-nav').click(self.changeStep);
		self.form.find('#ss-submit').click(self.submitFormAjax);
		self.form.find('.guest1')
			.find('.field-guest-first, .field-guest-last')
			.find('.control-label')
			.show();
		// Prevent Enter submitting the form accidentally
		self.form.find(':input').not(':button,:submit,textarea')
			.bind('keypress keydown keyup', function(event) {
				if (event.keyCode == 13)
					event.preventDefault();
			});

		// Sync data between fields
		self.form.find(".field-attending :radio")
			.change(self.attendanceChanged);
		self.form.find('#guest_count').change(self.adjustNumberOfGuestEntries).change();
		self.form.find('#user_first_dynamic, #user_last_dynamic').change(self.nameChanged);

		self.spotifyInput = new SpotifyTrackSearch(self.form.find('.field-song input'), self.form.find('#song_spotify_id'));

		// Focus the first field
		self.form.find(':input').first().focus();
	};

	this.initializeParsley = function() {
		// Assign fields to Parsley groups matching their steps so we can
		//  validate each step independently.
		//  Note: this needs to happen *before* Parsley is initialized
		self.form.find('.step').each(function () {
			var stepId = $(this).data('step');
			$(this).find(':input').attr('data-parsley-group', stepId)
		});

		self.form.parsley({
			successClass: "has-success",
			errorClass: "has-error",
			classHandler: function (el) {
				return el.$element.closest(".field");
			},
			errorsContainer: function (el) {
				return el.$element.closest(".field");
			},
			errorsWrapper: '<p class="help-block"></p>',
			errorTemplate: '<span></span>',
		});
	};

	this.changeStep = function(event) {
		var parsley = self.form.parsley();
		var steps = self.form.find('[data-step]');
		var current = $(event.target).closest('[data-step]');
		var nextId = $(event.target).data('next-step');
		var next = self.form.find('[data-step=' + nextId + ']');

		// only validate going forward. If current group is invalid, do not go further
		// .parsley().validate() returns validation result AND show errors
		if (steps.index(next) > steps.index(current))
			if (false === parsley.validate(current.data('step')))
				return;

		// validation was ok. We can go on next step.
		steps.hide();
		parsley.reset();
		next.show();
		next.find(':input').first().focus();
	};

	this.adjustNumberOfGuestEntries = function() {
		var guestCount = self.form.find('#guest_count');
		var count = guestCount.val() || 0;
		var guests = self.form.find('.guest');
		guests.each(function (i, guest) {
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
		if (guestCount.is(':focus')) {
			var inputs = guestCount.closest('.step').find(':input');
			inputs.eq( inputs.index(guestCount) + 1 ).focus();
		}
	};

	this.nameChanged = function() {
		self.form.find('#user_first_static')
			.text(self.form.find('#user_first_dynamic').val());
		self.form.find('#user_last_static')
			.text(self.form.find('#user_last_dynamic').val());
	};

	this.attendanceChanged = function() {
		var attendance = self.form.find('.field-attending');
		var attending = attendance.find('input:radio:checked').val();

		var thisStep = attendance.closest('.step');
		var lastStep = self.form.find(':submit').first().closest('.step');

		var guestCount = self.form.find('#guest_count');

		if ('no' == attending) {
			// If they're not attending, set guest count to 0 and set the
			//  navigation buttons to go straight from this step to the last
			guestCount.val(0);
			thisStep.find('.button-next')
				.data('next-step', lastStep.data('step'));
			lastStep.find('.button-prev')
				.data('next-step', thisStep.data('step'));
		} else { // 'yes' or undefined
			// If they're attending and they haven't already specified how many
			//  guests, then set it to 1
			if ('yes' == attending && ! guestCount.val())
				guestCount.val(1);

			// As they're attending, they need to go through the full form
			thisStep.find('.button-next').removeData('next-step');
			lastStep.find('.button-prev').removeData('next-step');
		}

		// Trigger onchange events for the guest count
		guestCount.change();
	};

	this.validateForm = function(event) {
		if (event) event.preventDefault();

		self.form.parsley().validate();
	};

	this.submitFormIframe = function(event) {
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

	this.submitFormAjax = function(event) {
		if (event) event.preventDefault();

		if (! self.form.parsley().validate())
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