

import stanford.karel.Karel;

public class CollectNewspaperKarel extends Karel {
	
	public void run(){
		wayToBeeper();
		pickBeeper();
		backHome();
	}

	
	private void wayToBeeper(){		
		move();
		move();
		turnLeft();
		turnLeft();
		turnLeft();
		move();
		turnLeft();
		move();
	}
	private void backHome(){	
		turnLeft();
		turnLeft();
		move();
		move();
		move();
		turnLeft();
		turnLeft();
		turnLeft();
		move();
		turnLeft();
		turnLeft();
		turnLeft();	
	}
	
}
