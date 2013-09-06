define(
  'ephox.robin.api.general.Pathway',

  [
    'ephox.phoenix.api.general.Gather',
    'ephox.robin.pathway.Prune',
    'ephox.robin.pathway.Simplify',
    'ephox.robin.pathway.Transform'
  ],

  function (Gather, Prune, Simplify, Transform) {

    /**
     * Gathers nodes between the start and finish elements.
     *
     * Where a node's children are all included, only the node is returned.
     */
    var between = function (universe, start, finish) {
      var prune = Prune.range(universe, start, finish);
      var transform = Transform(universe);
      var actual = Gather.gather(universe, start, prune, transform);
      return actual.left().concat([start]).concat(actual.right());
    };

    /**
     * @see Simplify.simplify()
     */
    var simplify = function (universe, elements) {
      return Simplify.simplify(universe, elements);
    };

    return {
      between: between,
      simplify: simplify
    };
  }
);
