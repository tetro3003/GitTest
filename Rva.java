

import stanford.karel.SuperKarel;

public class Rva extends SuperKarel {

	
	public void run() {
		
		minus();
	 
		
	}


private void minus(){
	
	int a = 0;
	int b = 0;
	
	move();
	
	while(beepersPresent()){
		a=a+1;
		pickBeeper();
	}
	move();
	while(beepersPresent()){
		b = b+1;
		pickBeeper();
	}
	move();
	for(int c=0; c<a*b; c++){
		putBeeper();
	}
	move();
	
	
	
}

}